// Vercel detects this Express entry point and runs it as a serverless function.
require('express');
module.exports = require('./server/index');
