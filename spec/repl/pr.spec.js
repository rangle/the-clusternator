'use strict';

const setup = require('./setup');
const PR = require(setup.path('aws', 'prManager.js'));

module.exports = PR(
  setup.getEc2(), setup.getEcs(), setup.getRoute53(), setup.getElb(),
  setup.testVPC, setup.testR53
);
