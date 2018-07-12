process.env.NODE_ENV = 'test';
const db = require('../db');
const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = require('../index');
const auth = {};

//Create tables
beforeAll(async () => {
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
    `CREATE TABLE jobs_users (id SERIAL PRIMARY KEY, job_id INTEGER REFERENCES jobs (id) ON DELETE CASCADE, company_id INTEGER REFERENCES companies (id) ON DELETE CASCADE);`
  );
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

afterEach(async () => {
  await db.query('DELETE FROM users');
  await db.query('DELETE FROM companies');
  await db.query('DELETE FROM jobs');
});
afterAll(async () => {
  await db.query('DROP TABLE IF EXISTS jobs_users');
  await db.query('DROP TABLE IF EXISTS jobs');
  await db.query('DROP TABLE IF EXISTS users');
  await db.query('DROP TABLE IF EXISTS companies');
  db.end();
});
