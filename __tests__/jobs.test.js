process.env.NODE_ENV = 'test';
const db = require('../db');
const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = require('../index');
const auth = {};

//Create tables
beforeAll(async () => {
  console.log('before all!');
  await db.query(
    `CREATE TABLE companies (id SERIAL PRIMARY KEY, handle TEXT UNIQUE NOT NULL, password TEXT NOT NULL, name TEXT NOT NULL, logo TEXT, email TEXT NOT NULL UNIQUE);`
  );

  await db.query(
    `CREATE TABLE jobs (id SERIAL PRIMARY KEY, title TEXT, salary INTEGER, equity REAL, company TEXT REFERENCES companies (handle) ON DELETE CASCADE);`
  );

  await db.query(
    `CREATE TABLE users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, first_name TEXT NOT NULL, last_name TEXT NOT NULL, email TEXT NOT NULL, photo TEXT, current_company TEXT REFERENCES companies (handle) ON DELETE CASCADE);`
  );

  await db.query(
    `CREATE TABLE applications (id SERIAL PRIMARY KEY, job_id INTEGER REFERENCES jobs (id) ON DELETE CASCADE, username TEXT REFERENCES users (username) ON DELETE CASCADE);`
  );
});

afterAll(async () => {
  console.log('after all!');

  await db.query('DROP TABLE IF EXISTS applications');
  await db.query('DROP TABLE IF EXISTS jobs');
  await db.query('DROP TABLE IF EXISTS users');
  await db.query('DROP TABLE IF EXISTS companies');
  db.end();
});

beforeEach(async () => {
  // login a user, get a token, store the user ID and token
  const hashedPassword = await bcrypt.hash('secret', 1);
  await db.query(
    "INSERT INTO users (username, password, first_name, last_name, email) VALUES ('test', $1, 'foo', 'bar', 'email@example.com')",
    [hashedPassword]
  );
  const response = await request(app)
    .post('/user-auth')
    .send({
      username: 'test',
      password: 'secret'
    });
  auth.user_token = response.body.token;
  auth.current_username = jwt.decode(auth.user_token).username;

  const hashedCompanyPassword = await bcrypt.hash('secret', 1);
  await db.query(
    "INSERT INTO companies (handle, password, name, email) VALUES ('testcompany', $1, 'testcompany', 'test@testcompany.com')",
    [hashedCompanyPassword]
  );
  const companyResponse = await request(app)
    .post('/company-auth')
    .send({
      handle: 'testcompany',
      password: 'secret'
    });
  auth.company_token = companyResponse.body.token;
  auth.current_company = jwt.decode(auth.company_token).handle;

  const jobResponse = await db.query(
    "INSERT INTO jobs (title, salary, equity, company) VALUES ('engineer', '100000', '5', 'testcompany') RETURNING id"
  );
  auth.job_id = jobResponse.rows[0].id;

  const applyForJob = await request(app)
    .post(`/jobs/${auth.job_id}/applications`)
    .set('authorization', auth.user_token);

  auth.application_id = applyForJob.body.id;
});

describe('GET /jobs', () => {
  test('gets a list of 1 job', async () => {
    const response = await request(app)
      .get('/jobs')
      .set('authorization', auth.company_token);
    expect(response.body).toHaveLength(1);
  });

  test('gets a list of 2 jobs', async () => {
    await db.query(
      "INSERT INTO jobs (title, salary, equity, company) VALUES ('manager', '150000', '3', 'testcompany')"
    );

    const response = await request(app)
      .get('/jobs')
      .set('authorization', auth.company_token);
    expect(response.body).toHaveLength(2);
  });
});

describe('POST /jobs', () => {
  test('add a job', async () => {
    const response = await request(app)
      .post('/jobs')
      .set('authorization', auth.company_token)
      .send({
        title: 'another engineer',
        salay: '200000',
        equity: '1'
      });
    expect(Object.keys(response.body)).toHaveLength(4);
    expect(response.body.company).toEqual('testcompany');
    expect(response.body.title).toEqual('another engineer');
  });
});

describe('GET /jobs/:id', () => {
  test('successfully gets a job by id', async () => {
    const response = await request(app)
      .get(`/jobs/${auth.job_id}`)
      .set('authorization', auth.company_token);
    expect(response.body.company).toEqual('testcompany');
    expect(Object.keys(response.body)).toHaveLength(4);
  });

  test('cannot get a job posting without authorization', async () => {
    const response = await request(app).get(`/jobs/${auth.job_id}`);
    expect(response.status).toBe(401);
  });
});

describe('PATCH /jobs/:id', () => {
  test('can selectively patch jobs', async () => {
    const response = await request(app)
      .patch(`/jobs/${auth.job_id}`)
      .set('authorization', auth.company_token)
      .send({
        title: 'test engineer',
        equity: '50'
      });
    expect(response.body.title).toEqual('test engineer');
    expect(Object.keys(response.body)).toHaveLength(4);
  });

  test('cannot patch a job with a different company', async () => {
    const hashedPassword = await bcrypt.hash('abc', 1);
    await db.query(
      "INSERT INTO companies (handle, password, name, email) VALUES ('testcompany2', $1, 'testcompany', 'test2@testcompany.com')",
      [hashedPassword]
    );

    const jobResponse = await db.query(
      "INSERT INTO jobs (title, salary, equity, company) VALUES ('secretary', '100000', '10', 'testcompany2') RETURNING id"
    );
    const jobID = jobResponse.rows[0].id;

    const response = await request(app)
      .patch(`/jobs/${jobID}`)
      .set('authorization', auth.company_token)
      .send({
        title: 'Tyler'
      });
    expect(response.status).toBe(403);
  });
});

describe('DELETE /jobs/:id', () => {
  test('successfully deletes own job', async () => {
    const response = await request(app)
      .delete(`/jobs/${auth.job_id}`)
      .set('authorization', auth.company_token);
    expect(response.status).toBe(200);
    expect(response.body.title).toBe('engineer');
  });

  test('cannot delete other job', async () => {
    const hashedPassword = await bcrypt.hash('abc', 1);
    await db.query(
      "INSERT INTO companies (handle, password, name, email) VALUES ('testcompany2', $1, 'testcompany', 'test2@testcompany.com')",
      [hashedPassword]
    );

    const jobResponse = await db.query(
      "INSERT INTO jobs (title, salary, equity, company) VALUES ('secretary', '100000', '10', 'testcompany2') RETURNING id"
    );
    const jobID = jobResponse.rows[0].id;

    const response = await request(app)
      .delete(`/jobs/${jobID}`)
      .set('authorization', auth.company_token);
    expect(response.status).toBe(403);
  });
});

describe('GET /jobs/:id/applications', () => {
  test('get a list of applications if you are the company', async () => {
    const newUserResponse = await request(app)
      .post('/users')
      .send({
        username: 'test_user',
        password: 'password',
        first_name: 'Test',
        last_name: 'User',
        email: 'test@user.com'
      });

    const newUserAuthResponse = await request(app)
      .post('/user-auth')
      .send({
        username: 'test_user',
        password: 'password'
      });
    const newUserToken = newUserAuthResponse.body.token;

    const applyforjob = await request(app)
      .post(`/jobs/${auth.job_id}/applications`)
      .set('authorization', newUserToken);

    const response = await request(app)
      .get(`/jobs/${auth.job_id}/applications`)
      .set('authorization', auth.company_token);
    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(2);
  });

  test('get just one application if you are the user', async () => {
    const response = await request(app)
      .get(`/jobs/${auth.job_id}/applications`)
      .set('authorization', auth.user_token);
    console.log(response);

    expect(response.status).toBe(200);
    expect(response.body).toHaveLength(1);
  });
});
describe('POST /jobs/:id/applications', () => {
  test('successfully applies for a job', async () => {
    const response = await request(app)
      .post(`/jobs/${auth.job_id}/applications`)
      .set('authorization', auth.user_token);

    const jobUserData = await db.query(
      `SELECT * FROM applications WHERE job_id=${auth.job_id} AND username='${
        auth.current_username
      }'`
    );
    expect(jobUserData.rows[0].job_id).toEqual(auth.job_id);
    expect(jobUserData.rows[0].username).toEqual(auth.current_username);
    expect(response.status).toBe(200);
    expect(response.body.username).toEqual(auth.current_username);
  });
});

describe('GET /jobs/:id/applications/:applicationID', () => {
  test('successfully gets own job application', async () => {
    const userResponse = await request(app)
      .get(`/users/${auth.current_username}`)
      .set('authorization', auth.user_token);
    const applicationID = userResponse.body.applied_to[0];

    const response = await request(app)
      .get(`/jobs/${auth.job_id}/applications/${applicationID}`)
      .set('authorization', auth.user_token);

    expect(response.status).toBe(200);
    expect(response.body.job_id).toBe(auth.job_id);
  });
  test('get 403 if user does not match application id', async () => {
    const newUserResponse = await request(app)
      .post('/users')
      .send({
        username: 'test_user',
        password: 'password',
        first_name: 'Test',
        last_name: 'User',
        email: 'test@user.com'
      });

    const newUserAuthResponse = await request(app)
      .post('/user-auth')
      .send({
        username: 'test_user',
        password: 'password'
      });
    const newUserToken = newUserAuthResponse.body.token;

    const response = await request(app)
      .get(`/jobs/${auth.job_id}/applications/${auth.application_id}`)
      .set('authorization', newUserToken);

    expect(response.status).toBe(403);
    expect(response.body.message).toEqual(
      'You are not allowed to access this resource.'
    );
  });
  test('get 404 if application id does not exist', async () => {
    const userResponse = await request(app)
      .get(`/users/${auth.current_username}`)
      .set('authorization', auth.user_token);
    const jobID = userResponse.body.applied_to[0];
    const response = await request(app)
      .get(`/jobs/${auth.job_id}/applications/15351351`)
      .set('authorization', auth.user_token);

    expect(response.status).toBe(404);
    expect(response.body.message).toEqual('Record with that ID was not found.');
  });

  test('company can successfully get job application by appliation id', async () => {
    const companyResponse = await request(app)
      .get(`/jobs/${auth.job_id}/applications/${auth.application_id}`)
      .set('authorization', auth.company_token);

    expect(companyResponse.status).toBe(200);
    expect(companyResponse.body.job_id).toBe(auth.job_id);
  });

  test('company cannot get job application for a job it has not posted itself', async () => {
    const hashedCompanyPassword = await bcrypt.hash('pass', 1);
    await db.query(
      "INSERT INTO companies (handle, password, name, email) VALUES ('testcompany2', $1, 'testcompany2', 'test2@testcompany2.com')",
      [hashedCompanyPassword]
    );
    const newCompanyResponse = await request(app)
      .post('/company-auth')
      .send({
        handle: 'testcompany2',
        password: 'pass'
      });
    const newCompanyToken = newCompanyResponse.body.token;

    //delete job as new company
    const response = await request(app)
      .get(`/jobs/${auth.job_id}/applications/${auth.application_id}`)
      .set('authorization', newCompanyToken);

    expect(response.status).toBe(403);
    expect(response.body.message).toEqual(
      'You are not allowed to access this resource.'
    );
  });
  test('company gets 404 if not found', async () => {
    const response = await request(app)
      .get(`/jobs/${auth.job_id}/applications/15351351`)
      .set('authorization', auth.company_token);

    expect(response.status).toBe(404);
    expect(response.body.message).toEqual('Record with that ID was not found.');
  });
});

describe('DELETE /jobs/:id/applications/:applicationID', () => {
  test('successfully deletes own job application', async () => {
    const userResponse = await request(app)
      .get(`/users/${auth.current_username}`)
      .set('authorization', auth.user_token);
    const jobID = userResponse.body.applied_to[0];

    const response = await request(app)
      .delete(`/jobs/${auth.job_id}/applications/${jobID}`)
      .set('authorization', auth.user_token);
    expect(response.status).toBe(200);
    expect(response.body.message).toEqual(
      'Successfully deleted job application.'
    );
  });

  test('user cannot delete a job application that is not theirs', async () => {
    // create a new user AND apply for new job
    const newUserResponse = await request(app)
      .post('/users')
      .send({
        username: 'test_user',
        password: 'password',
        first_name: 'Test',
        last_name: 'User',
        email: 'test@user.com'
      });

    const newUserAuthResponse = await request(app)
      .post('/user-auth')
      .send({
        username: 'test_user',
        password: 'password'
      });
    const newUserToken = newUserAuthResponse.body.token;

    const applyforjob = await request(app)
      .post(`/jobs/${auth.job_id}/applications`)
      .set('authorization', auth.user_token);

    const userResponse = await request(app)
      .get(`/users/${auth.current_username}`)
      .set('authorization', auth.user_token);
    const jobID = userResponse.body.applied_to[0];
    // then attempt to delete with different user

    const response = await request(app)
      .delete(`/jobs/${auth.job_id}/applications/${jobID}`)
      .set('authorization', newUserToken);
    expect(response.status).toBe(403);
    expect(response.body.message).toEqual(
      'You are not allowed to access this resource.'
    );
  });

  test('company can successfully delete applicant from their job', async () => {
    // apply to job
    const applicationResponse = await request(app)
      .post(`/jobs/${auth.job_id}/applications`)
      .set('authorization', auth.user_token);

    const userResponse = await request(app)
      .get(`/users/${auth.current_username}`)
      .set('authorization', auth.user_token);
    const jobID = userResponse.body.applied_to[0];

    //delete job as company
    const response = await request(app)
      .delete(`/jobs/${auth.job_id}/applications/${jobID}`)
      .set('authorization', auth.company_token);
    expect(response.status).toBe(200);
    expect(response.body.message).toEqual(
      'Successfully deleted job application.'
    );
  });

  test('company cannot delete a job application that is not theirs', async () => {
    const applicationResponse = await request(app)
      .post(`/jobs/${auth.job_id}/applications`)
      .set('authorization', auth.user_token);

    const userResponse = await request(app)
      .get(`/users/${auth.current_username}`)
      .set('authorization', auth.user_token);
    const jobID = userResponse.body.applied_to[0];

    //create a new company
    const hashedCompanyPassword = await bcrypt.hash('pass', 1);
    await db.query(
      "INSERT INTO companies (handle, password, name, email) VALUES ('testcompany2', $1, 'testcompany2', 'test2@testcompany2.com')",
      [hashedCompanyPassword]
    );
    const newCompanyResponse = await request(app)
      .post('/company-auth')
      .send({
        handle: 'testcompany2',
        password: 'pass'
      });
    const newCompanyToken = newCompanyResponse.body.token;

    //delete job as new company
    const response = await request(app)
      .delete(`/jobs/${auth.job_id}/applications/${jobID}`)
      .set('authorization', newCompanyToken);

    expect(response.status).toBe(403);
    expect(response.body.message).toEqual(
      'You are not allowed to access this resource.'
    );
  });

  test('cannot delete an application without a token', async () => {
    // // apply to job

    const userResponse = await request(app)
      .get(`/users/${auth.current_username}`)
      .set('authorization', auth.user_token);
    const jobID = userResponse.body.applied_to[0];

    //delete job as company
    const response = await request(app).delete(
      `/jobs/${auth.job_id}/applications/${jobID}`
    );
    expect(response.status).toBe(401);
    expect(response.body.message).toEqual(
      'You need to authenticate before accessing this resource.'
    );
  });
});

afterEach(async () => {
  await db.query('DELETE FROM users');
  await db.query('DELETE FROM companies');
  await db.query('DELETE FROM jobs');
  await db.query('DELETE FROM applications');
});
