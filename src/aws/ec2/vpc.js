'use strict';

const R = require('ramda');

const filter = require('./ec2-filter');
const tag = require('./ec2-tag');
const constants = require('../../constants');
const awsUtil = require('../aws-util');
const CIDR_BLOCK = require('../aws-constants').CIDR_BLOCK;

module.exports = {
  bindAws,
  helpers: {
    findProjectTag: findProjectTag,
    findMasterVPC: findMasterVPC
  },
  create,
  describe,
  destroy,
  list
};

/**
 * @param {AwsWrapper} aws
 * @returns {Object} this API bound to
 */
function bindAws(aws) {
  return awsUtil.bindAws(aws, module.exports);
}

/**
 * @param {AwsWrapper} aws
 * @returns {function(): Promise}
 */
function describe(aws) {

  function promiseToDescribe() {
    return aws.ec2.describeVpcs({
      DryRun: false,
      Filters: [filter.createClusternator()]
    });
  }

  return promiseToDescribe;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} cidrBlock
 * @returns {function(): Promise<object>}
 */
function create(aws) {

  function promiseToCreate() {
    return aws.ec2
      .createVpc({
        DryRun: false,
        CidrBlock: CIDR_BLOCK
      })
      .then((result) => result.Vpc)
      .then((vpc) => tag
        .tag(aws, [vpc.VpcId], [tag.createClusternator()])()
        .then(() => vpc)
      );
  }

  return promiseToCreate;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} vpcId
 * @returns {function(): Promise.<string>}
 */
function destroy(aws, vpcId) {

  function promiseToDestroy() {
    return aws.ec2
      .deleteVpc({VpcId: vpcId})
      .then(() => 'deleted');
  }

  return promiseToDestroy;
}

/**
 * @param {AwsWrapper} aws
 * @returns {function(): Promise<string[]>}
 */
function list(aws) {

  function promiseToList() {
    return describe(aws)()
      .then((result) => R.map(R.prop('VpcId'), result.Vpcs));
  }

  return promiseToList;
}

/**
  finds a vpc from a project
  @param {string} projectId
  @param {Object} list (see AWS docs)
  http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2.html
*/
function findProjectTag(projectId, list) {

  function promiseToFindProjectTag() {
    return R.find((vDesc) => (
      R.any(R.allPass([
        R.propEq('Key', constants.PROJECT_TAG),
        R.propEq('Value', projectId)
      ]))(vDesc.Tags)
    ))(list.Vpcs) || null;
  }

  return promiseToFindProjectTag;
}

/**
  finds the _last_ clusternator tagged VPC _without_ a clusternator proj tag
  @param {Object} list (see AWS docs)
  http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2.html
*/
function findMasterVPC(list) {

  function promiseToFindMasterVPC() {
    return R.find((vDesc) => (
      R.none(R.propEq('Key', constants.PROJECT_TAG))(vDesc.Tags)
    ))(list.Vpcs) || null;
  }

  return promiseToFindMasterVPC;
}
