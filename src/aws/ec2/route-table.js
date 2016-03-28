'use strict';

const filter = require('./ec2-filter');

module.exports = {
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
      .then((result) => result.RouteTable);
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