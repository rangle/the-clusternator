'use strict';

const filter = require('./ec2-filter');
const tag = require('./ec2-tag');
const constants = require('../../constants');
const util = require('../../util');
const awsCommon = require('../common');
const awsConstants = require('../aws-constants');

module.exports = {
  bindAws,
  create,
  describe,
  destroy,
  findDefault,
  list
};

/**
 * @param {AwsWrapper} aws
 * @returns {Object} this API bound to
 */
function bindAws(aws) {
  return awsCommon.bindAws(aws, module.exports);
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
    return describe(aws)()
      .then((desc) => desc.RouteTables && desc.RouteTables.length ?
        desc.RouteTables[0] :
        aws.ec2
          .createRouteTable({
            VpcId: aws.vpcId
          })
          .then((result) => result.RouteTable)
          .then((routeTable) => util.makeRetryPromiseFunction(tag
            .tag(aws, [routeTable.RouteTableId], [tag.createClusternator()]),
            awsConstants.AWS_RETRY_LIMIT,
            awsConstants.AWS_RETRY_DELAY,
            awsConstants.AWS_RETRY_MULTIPLIER,
            null,
            'create route-table tag')()
            .then(() => routeTable)) );
  }

  return promiseToCreate;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} routeTableId
 * @returns {function(): Promise.<string>}
 * @throws {TypeError}
 */
function destroy(aws, routeTableId) {
  if (!routeTableId) {
    throw new TypeError('destroy requires a routeTableId');
  }

  function promiseToDestroy() {
    return list(aws)()
      .then((routes) => routes.indexOf(routeTableId) === -1 ?
        'already deleted' :
        aws.ec2
          .deleteRouteTable({ RouteTableId: routeTableId })
          .then(() => 'deleted'));
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

      if (routes.RouteTables && routes.RouteTables.length) {
        return routes.RouteTables[0];
      }
      
      throw new Error('No Clusternator Route For VPC: ' + aws.vpcId);
    });
  }

  return promiseToFindDefault;
}
