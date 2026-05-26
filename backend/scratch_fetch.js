const fetch = require('node-fetch'); // or axios
// Since we don't have node-fetch or axios, we can use the http module
const http = require('http');

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/parent/dashboard/children/performance',
  method: 'GET',
  headers: {
    // Need a valid token for a parent!
  }
};
