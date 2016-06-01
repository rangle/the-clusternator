'use strict';

const setup = require('./setup');
const Deployment = require(setup.path('aws', 'deploymentManager.js'));

module.exports = Deployment(
  setup.getEc2(), setup.getEcs(), setup.getRoute53(), setup.getElb(),
  setup.testVPC, setup.testR53
);
