const fs = require('fs');
const path = require('path');

const source = path.resolve(__dirname, '../client/dist');
const destination = path.resolve(__dirname, '../public');

fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(source, destination, { recursive: true });
