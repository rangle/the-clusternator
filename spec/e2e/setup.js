'use strict';
const TEST_VPC = 'vpc-ab07b4cf';
const TEST_ROUTE = 'rtb-79284a1d';
const TEST_R53 = '/hostedzone/Z1K98SX385PNRP';

var path = require('path');

var sourcePath = path.join('..', '..', 'src');

var c = require(path.join(sourcePath, 'config')),
a = require('aws-sdk');

function getIam() {
  var config = c();
  return new a.IAM(config.awsCredentials);
}

function getEc2() {
  var config = c();
  return new a.EC2(config.awsCredentials);
}

function getEcs() {
  var config = c();
  return new a.ECS(config.awsCredentials);
}

function getRoute53() {
  var config = c();
  return new a.Route53(config.awsCredentials);
}

function getDDB() {
  var config = c();
  return new a.DynamoDB(config.awsCredentials);
}

function makePath() {
    var args = Array.prototype.slice.apply(arguments);
    args.unshift(sourcePath);
    return path.join.apply(path, args);
}

module.exports = {
  path: makePath,
  getEc2,
  getEcs,
  getIam,
  getRoute53,
  getDDB,
  testVPC: TEST_VPC,
  testROUTE: TEST_ROUTE,
  testR53: TEST_R53
};
