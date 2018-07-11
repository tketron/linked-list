const { Client } = require('pg');
//Check if in testing to set database name
const db =
  process.env.NODE_ENV === 'test' ? 'linked_list_test_db' : 'linked_list_db';
const client = new Client({
  connectionString: `postgresql://localhost/${db}`
});

client.connect();

module.exports = client;
