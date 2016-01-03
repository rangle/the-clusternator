var setup = require('./setup'),
Project = require(setup.path('aws', 'projectManager.js'));

module.exports = Project(setup.getEc2(), setup.getEcs(), setup.getRoute53(),
  setup.getDDB(), setup.getIam());
