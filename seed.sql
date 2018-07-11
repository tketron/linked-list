DROP DATABASE IF EXISTS "jobs_db";
CREATE DATABASE "jobs_db";
\c "jobs_db";

CREATE TABLE companies (id SERIAL PRIMARY KEY, handle TEXT UNIQUE NOT NULL, password TEXT NOT NULL, name TEXT, logo TEXT);
INSERT INTO companies (name, logo) VALUES ('haleyaldrich', 'environment', 'Haley & Aldrich', 'http://www.haleyandaldrich.com');

CREATE TABLE jobs (id SERIAL PRIMARY KEY, title TEXT, salary INTEGER, equity REAL, company_id INTEGER REFERENCES companies (id) ON DELETE CASCADE);
INSERT INTO jobs (title, salary, equity, company_id) VALUES ('Teacher', '100000', '4', 1);

CREATE TABLE users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, first_name TEXT, last_name TEXT, email TEXT, photo TEXT, current_company_id INTEGER REFERENCES companies (id) ON DELETE CASCADE);
INSERT INTO users (username, password, first_name, last_name, email, photo) VALUES ('tketron', 'abc123', 'Tyler', 'Ketron', 'tketron@gmailcom', 'http//www.fakeavatar.com');

CREATE TABLE jobs_users (id SERIAL PRIMARY KEY, job_id INTEGER REFERENCES jobs (id) ON DELETE CASCADE, company_id INTEGER REFERENCES companies (id) ON DELETE CASCADE);
INSERT INTO jobs_users (job_id, company_id) VALUES (1, 1);