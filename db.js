// db.js

const { Client } = require('pg');

// Set up the connection configuration
const client = new Client({
  user: 'myapp_user',          // Your PostgreSQL username
  host: 'localhost',           // PostgreSQL host (use 'localhost' for local machine)
  database: 'myapp_db',        // Your database name
  password: 'mypassword123',   // Your PostgreSQL password
  port: 5432,                  // PostgreSQL default port
});

// Connect to the database
client.connect()
  .then(() => console.log('Connected to PostgreSQL'))
  .catch(err => console.error('Connection error', err.stack));

// Export the client for use in other files
module.exports = client;
