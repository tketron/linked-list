const { Client } = require('pg');
//Check if in testing to set database name
const db = process.env.NODE_ENV === 'test' ? 'jobs_db_test' : 'jobs_db';
const client = new Client({
  connectionString: `postgresql://localhost/${db}`
});

client.connect();

module.exports = client;
