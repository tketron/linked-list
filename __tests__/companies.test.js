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
  // const hashedPassword = await bcrypt.hash('secret', 1);
  // await db.query(
  //   "INSERT INTO users (username, password, first_name, last_name, email) VALUES ('test', $1, 'foo', 'bar', 'email@example.com')",
  //   [hashedPassword]
  // );
  // const response = await request(app)
  //   .post('/user-auth')
  //   .send({
  //     username: 'test',
  //     password: 'secret'
  //   });
  // auth.user_token = response.body.token;
  // auth.current_username = jwt.decode(auth.user_token).username;

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
});

describe('GET /companies', () => {
  test('gets a list of 1 company', async () => {
    const response = await request(app)
      .get('/companies')
      .set('authorization', auth.company_token);
    expect(response.body).toHaveLength(1);
  });

  test('gets a list of 2 users', async () => {
    const hashedPassword = await bcrypt.hash('abc', 1);
    await db.query(
      "INSERT INTO companies (handle, password, name, email) VALUES ('testcompany2', $1, 'testcompany', 'test2@testcompany.com')",
      [hashedPassword]
    );

    const response = await request(app)
      .get('/companies')
      .set('authorization', auth.company_token);
    expect(response.body).toHaveLength(2);
  });
});

describe('POST /companies', () => {
  test('add a company', async () => {
    const response = await request(app)
      .post('/companies')
      .send({
        handle: 'test_company',
        password: 'password',
        name: 'test_company',
        logo: 'logo.com',
        email: 'test_company@company.com'
      });
    expect(Object.keys(response.body)).toHaveLength(5);
    expect(response.body.handle).toEqual('test_company');
    expect(response.body.password).toBeUndefined();
  });
  test('cannot add a duplicate comapny', async () => {
    const firstResponse = await request(app)
      .post('/companies')
      .send({
        handle: 'test_company',
        password: 'password',
        name: 'test_company',
        logo: 'logo.com',
        email: 'test_company@company.com'
      });
    const secondResponse = await request(app)
      .post('/companies')
      .send({
        handle: 'test_company',
        password: 'password',
        name: 'test_company',
        logo: 'logo.com',
        email: 'test_company@company.com'
      });
    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.message).toEqual(
      'Company handle already exists.'
    );
  });
});

describe('GET /companies/:handle', () => {
  test('successfully gets a company by handle', async () => {
    const response = await request(app)
      .get('/companies/testcompany')
      .set('authorization', auth.company_token);

    expect(response.body.handle).toEqual('testcompany');
    expect(Object.keys(response.body)).toHaveLength(7);
  });
});

describe('PATCH /companies/:handle', () => {
  test('can selectively patch companies', async () => {
    const response = await request(app)
      .patch(`/companies/${auth.current_company}`)
      .set('authorization', auth.company_token)
      .send({
        email: 'Tyler@tyler.com',
        logo: 'thisisalogo',
        password: 'newsecret'
      });
    expect(response.body.email).toEqual('Tyler@tyler.com');
    expect(Object.keys(response.body)).toHaveLength(7);
  });

  // TODO
  test('cannot patch another user', async () => {
    const hashedPassword = await bcrypt.hash('abc', 1);
    await db.query(
      "INSERT INTO companies (handle, password, name, email) VALUES ('testcompany2', $1, 'testcompany', 'test2@testcompany.com')",
      [hashedPassword]
    );
    const response = await request(app)
      .patch(`/companies/testcompany2`)
      .set('authorization', auth.company_token)
      .send({
        logo: 'Tyler'
      });
    expect(response.status).toBe(403);
  });
});

describe('DELETE /companies/:handle/', () => {
  test('successfully deletes own company', async () => {
    const response = await request(app)
      .delete(`/companies/${auth.current_company}`)
      .set('authorization', auth.company_token);
    expect(response.status).toBe(200);
    expect(response.body.handle).toBe(auth.current_company);
  });
});

test('cannot delete other user', async () => {
  const hashedPassword = await bcrypt.hash('abc', 1);
  await db.query(
    "INSERT INTO companies (handle, password, name, email) VALUES ('testcompany2', $1, 'testcompany', 'test2@testcompany.com')",
    [hashedPassword]
  );
  const response = await request(app)
    .delete(`/companies/testcompany2`)
    .set('authorization', auth.company_token);
  expect(response.status).toBe(403);
});

afterEach(async () => {
  await db.query('DELETE FROM users');
  await db.query('DELETE FROM companies');
  await db.query('DELETE FROM jobs');
});
