'use strict';

const setup = require('./setup');
const Service = require(setup.path('aws', 'taskServiceManager.js'));

module.exports = Service(setup.getEcs());
