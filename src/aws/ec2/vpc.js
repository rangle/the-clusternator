'use strict';

const R = require('ramda');

const filter = require('./ec2-filter');
const tag = require('./ec2-tag');
const awsConstants = require('../aws-constants');
const constants = require('../../constants');
const awsUtil = require('../aws-util');
const CIDR_BLOCK = require('../aws-constants').CIDR_BLOCK;
const util = require('../../util');

module.exports = {
  bindAws,
  create,
  describe,
  destroy,
  findVpc,
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
      Filters: [filter.createClusternator()]
    });
  }

  return promiseToDescribe;
}

/**
 * @param {AwsWrapper} aws
 * @returns {function(): Promise<object>}
 */
function create(aws) {

  function promiseToCreate() {
    return describe(aws)()
      .then((result) => result.Vpcs && result.Vpcs.length ?
        result.Vpcs[0] :
        aws.ec2.createVpc({ CidrBlock: CIDR_BLOCK })
          .then((result) => result.Vpc)
          .then((vpc) => util.makeRetryPromiseFunction(tag
            .tag(aws, [vpc.VpcId], [tag.createClusternator()]),
            awsConstants.AWS_RETRY_LIMIT,
            awsConstants.AWS_RETRY_DELAY,
            awsConstants.AWS_RETRY_MULTIPLIER,
            null,
            'vpc-create-tag')()
            .then(() => vpc)));
  }

  return promiseToCreate;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} vpcId
 * @returns {function(): Promise.<string>}
 * @throws {TypeError}
 */
function destroy(aws, vpcId) {
  if (!vpcId) {
    throw new TypeError('vpc.destroy requires vpcId');
  }

  function promiseToDestroy() {
    return list(aws)()
      .then((results) => results.indexOf(vpcId) === -1 ?
        'already deleted' :
        aws.ec2
          .deleteVpc({VpcId: vpcId})
          .then(() => 'deleted'));
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
  finds the _last_ clusternator tagged VPC _without_ a clusternator proj tag
  @param {Object} list (see AWS docs)
  http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2.html
*/
function findVpc(list) {

  function promiseToFindMasterVPC() {
    return R.find((vDesc) => (
      R.none(R.propEq('Key', constants.CLUSTERNATOR_TAG))(vDesc.Tags)
    ))(list.Vpcs) || null;
  }

  return promiseToFindMasterVPC;
}
