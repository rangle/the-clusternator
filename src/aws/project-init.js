'use strict';

const awsProjectManager = require('./projectManager');

/**
 * @returns {Q.Promise}
 */
function initAwsProject(config) {
  const a = require('aws-sdk');
  const ec2 = new a.EC2(config.awsCredentials);
  const ecs = new a.ECS(config.awsCredentials);
  const r53 = new a.Route53(config.awsCredentials);
  const ddb = new a.DynamoDB(config.awsCredentials);
  const iam = new a.IAM(config.awsCredentials);

  return awsProjectManager(ec2, ecs, r53, ddb, iam);
}

module.exports = initAwsProject;
