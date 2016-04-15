'use strict';

const filter = require('./ec2-filter');
const tag = require('./ec2-tag');
const constants = require('../../constants');
const awsUtil = require('../aws-util');

module.exports = {
  bindAws,
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
    return aws.ec2.describeRouteTables({
      DryRun: false,
      Filters: [
        filter.createVpc(aws.vpcId),
        filter.createClusternator()
      ]
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
    return aws.ec2
      .createRouteTable({
        DryRun: false,
        VpcId: aws.vpcId
      })
      .then((result) => result.RouteTable)
      .then((routeTable) => tag
        .tag(aws, [routeTable.RouteTableId], [tag.createClusternator()])()
        .then(() => routeTable)
      );
  }

  return promiseToCreate;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} vpcId
 * @returns {function(): Promise.<string>}
 */
function destroy(aws, routeTableId) {

  function promiseToDestroy() {
    return aws.ec2
      .deleteRouteTable({RouteTableId: routeTableId})
      .then(() => 'deleted');
  }

  return promiseToDestroy;
}

/**
 * @param {Object} el
 * @returns {string}
 */
function mapDescription(el) {
  return el.RouteTableId;
}

/**
 * @param {Array} descriptions
 * @returns {Array}
 */
function mapDescribeToRouteTableIds(descriptions) {
  return descriptions.map(mapDescription);
}

/**
 * @param {AwsWrapper} aws
 * @returns {function(): Promise<string[]>}
 */
function list(aws) {

  function promiseToList() {
    return describe(aws)()
      .then((result) => mapDescribeToRouteTableIds(result.RouteTables));
  }

  return promiseToList;
}

/**
 * @param {AwsWrapper} aws
 * @returns {function(): Promise<Object>}
 */
function findDefault(aws) {
  function promiseToFindDefault() {
    return describe(aws)().then((routes) => {

      let theRouteDesc = routes.find((rDesc) => (
        rDesc.Tags.some((tag) => tag.Key === constants.CLUSTERNATOR_TAG)
      ));

      if (theRouteDesc) {
        return theRouteDesc;
      }

      throw new Error('No Clusternator Route For VPC: ' + aws.vpcId);
    });
  }

  return promiseToFindDefault;
}
