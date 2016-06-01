'use strict';

const setup = require('./setup');
const Cluster = require(setup.path('aws', 'clusterManager.js'));

module.exports = Cluster(setup.getEcs(), setup.testVPC);
