'use strict';

const setup = require('./setup');
const Acl = require(setup.path('aws', 'aclManager.js'));

module.exports = Acl(setup.getEc2(), setup.testVPC);
