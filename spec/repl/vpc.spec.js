'use strict';

const setup = require('./setup');

const util = require(setup.path('util'));
const VPC = require(setup.path('aws', 'ec2', 'vpc.js'));

module.exports = VPC.bindAws({
  ec2: util.makePromiseApi(setup.getEc2()),
  vpcId: setup.testVPC
});
