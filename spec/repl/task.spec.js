'use strict';

const setup = require('./setup');
const Task = require(setup.path('aws', 'taskServiceManager.js'));

module.exports = Task(setup.getEcs());
