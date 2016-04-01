var setup = require('./setup');

const util = require(setup.path('util'));
const RT = require(setup.path('aws', 'ec2', 'route-table.js'));

module.exports = RT.bindAws({
  ec2: util.makePromiseApi(setup.getEc2()),
  vpcId: setup.testVPC
});

