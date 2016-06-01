'use strict';

const setup = require('./setup');
const Task = require(setup.path('aws', 'taskDefinitionManager.js'));

module.exports = Task(setup.getEcs());
