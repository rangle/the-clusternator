'use strict';

const setup = require('./setup');

const util = require(setup.path('util'));
const SG = require(setup.path('aws', 'ec2', 'security-groups',
  'security-groups.js'));

module.exports = SG.bindAws({
  ec2: util.makePromiseApi(setup.getEc2()),
  vpcId: setup.testVPC
});
