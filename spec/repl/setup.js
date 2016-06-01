'use strict';

const TEST_VPC = 'vpc-ab07b4cf';
const TEST_ROUTE = 'rtb-79284a1d';
const TEST_R53 = '/hostedzone/Z1K98SX385PNRP';

const path = require('path');
const https = require('https');

const sourcePath = path.join('..', '..', 'src');

const c = require(path.join(sourcePath, 'config'));
const a = require('aws-sdk');

function getIam() {
  const config = c();
  return new a.IAM(config.awsCredentials);
}

function getEcr() {
  const config = c();
  return new a.ECR(config.awsCredentials);
}

function getEc2() {
  const config = c();
  return new a.EC2(config.awsCredentials);
}

function getEcs() {
  const config = c();
  return new a.ECS(config.awsCredentials);
}

function getElb() {
  const config = c();
  return new a.ELB(config.awsCredentials);
}

function getRoute53() {
  const config = c();
  return new a.Route53(config.awsCredentials);
}

function getDDB() {
  const config = c();
  let nodeGt10Config =  {
    httpOptions: {
      agent: new https.Agent({
        ciphers: 'ALL',
        secureProtocol: 'TLSv1_method'
      })
    }
  };
  Object.keys(config.awsCredentials).forEach((attr) => {
    nodeGt10Config[attr] = config.awsCredentials[attr];
  });
  return new a.DynamoDB(nodeGt10Config);
}

function makePath() {
  const args = Array.prototype.slice.apply(arguments);
  args.unshift(sourcePath);
  return path.join.apply(path, args);
}

module.exports = {
  path: makePath,
  getEc2,
  getEcs,
  getElb,
  getEcr,
  getIam,
  getRoute53,
  getDDB,
  testVPC: TEST_VPC,
  testROUTE: TEST_ROUTE,
  testR53: TEST_R53
};
