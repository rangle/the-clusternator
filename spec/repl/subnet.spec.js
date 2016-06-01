'use strict';

const setup = require('./setup');
const Subnet = require(setup.path('aws', 'subnetManager.js'));

module.exports = Subnet(setup.getEc2(), setup.testVPC);
