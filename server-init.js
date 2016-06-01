'use strict';

const server = require('./src/server/main');
const config = require('./src/config')();

server.startServer(config);
