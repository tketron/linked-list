DROP DATABASE IF EXISTS "linked_list_db";
CREATE DATABASE "linked_list_db";
\c "linked_list_db";

CREATE TABLE companies (
  id SERIAL PRIMARY KEY, 
  handle TEXT UNIQUE NOT NULL, 
  password TEXT NOT NULL, 
  name TEXT NOT NULL, 
  logo TEXT, 
  email TEXT NOT NULL UNIQUE
  );

INSERT INTO companies (handle, password, name, logo, email) VALUES ('haleyaldrich', 'environment', 'Haley & Aldrich', 'http://www.haleyandaldrich.com', 'hr@haleyaldrich.com');

CREATE TABLE jobs (
  id SERIAL PRIMARY KEY, 
  title TEXT, 
  salary INTEGER, 
  equity REAL, 
  company TEXT REFERENCES companies (handle) ON DELETE CASCADE);

INSERT INTO jobs (title, salary, equity, company) VALUES ('Teacher', '100000', '4', 'haleyaldrich');

CREATE TABLE users (
  id SERIAL PRIMARY KEY, 
  username TEXT UNIQUE NOT NULL, 
  password TEXT NOT NULL, 
  first_name TEXT NOT NULL, 
  last_name TEXT NOT NULL, 
  email TEXT NOT NULL, 
  photo TEXT, 
  current_company TEXT REFERENCES companies (handle) ON DELETE CASCADE
);

INSERT INTO users (username, password, first_name, last_name, email, photo) VALUES ('tketron', 'abc123', 'Tyler', 'Ketron', 'tketron@gmailcom', 'http//www.fakeavatar.com');

CREATE TABLE jobs_users (id SERIAL PRIMARY KEY, job_id INTEGER REFERENCES jobs (id) ON DELETE CASCADE, username TEXT REFERENCES users (username) ON DELETE CASCADE);
INSERT INTO jobs_users (job_id, username) VALUES (1, 'tketron');