'use strict';

const setup = require('./setup');
const Project = require(setup.path('aws', 'projectManager.js'));

module.exports = Project(setup.getEc2(), setup.getEcs(), setup.getRoute53(),
  setup.getDDB(), setup.getIam(), setup.getEcr(), setup.getElb());
