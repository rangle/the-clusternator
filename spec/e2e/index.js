'use strict';
var util = require('util');

function logOutput() {
  var output = '', i;

  for (i = 0; i < arguments.length; i += 1) {
    if (typeof arguments[i] === 'object') {
      output += util.inspect(arguments[i], { depth: 5 });
    } else {
      output += arguments[i];
    }
    output += ' ';
  }
  console.log(output);
}

function logError(e) {
  console.log(e.message);
  console.log(e.stack);
}

module.exports = {
  acl: require('./acl.spec'),
  cluster: require('./cluster.spec'),
  deployment: require('./deployment.spec'),
  ec2: require('./ec2.spec'),
  pr: require('./pr.spec'),
  project: require('./project.spec'),
  r53: require('./route53.spec'),
  routes: require('./routes.spec'),
  securityGroups: require('./securityGroup.spec'),
  service: require('./service.spec'),
  setup: require('./setup'),
  subnet: require('./subnet.spec'),
  task: require('./task.spec'),
  taskDefinition: require('./taskDefinition.spec'),
  vpc: require('./vpc.spec'),
  iam: require('./iam.spec'),
  log: logOutput,
  error: logError,
  appDef: require('../../examples/node-mongo/appdef.json')
};
