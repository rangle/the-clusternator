'use strict';

const setup = require('./setup');
const Route53 = require(setup.path('aws', 'route53Manager.js'));

module.exports = Route53(setup.getRoute53(), setup.testR53);
