'use strict';

const R = require('ramda');

const filter = require('./ec2-filter');
const constants = require('../../constants');

module.exports = {
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
function create(aws, cidrBlock) {

  function promiseToCreate() {
    return aws.ec2
      .createVpc({
        DryRun: false,
        CidrBlock: cidrBlock
      })
      .then((result) => result.Vpc);
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
 * @param {Object} el
 * @returns {string}
 */
function mapDescription(el) {
  return el.VpcId;
}

/**
 * @param {Array} descriptions
 * @returns {Array}
 */
function mapDescribeToVpcIds(descriptions) {
  return descriptions.map(mapDescription);
}

/**
 * @param {AwsWrapper} aws
 * @returns {function(): Promise<string[]>}
 */
function list(aws) {

  function promiseToList() {
    return describe(aws)()
      .then((result) => mapDescribeToVpcIds(result.Vpcs));
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
