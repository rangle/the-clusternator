'use strict';
/**
 * Simplifies dealing with AWS's ECS container instances
 *
 * @module aws/ecs/container-instances
 */

const R = require('ramda');
const awsUtil = require('../aws-util');

module.exports = {
  bindAws,
  create: findOrCreate,
  describe,
  destroy: findAndDestroy,
  list,
  helpers: {
    create,
    destroy
  }
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
 * @param {string} instanceArn
 * @param {string} clusterArn
 * @returns {function(): Promise}
 */
function create(aws, clusterArn, instanceArn) {
  if (!clusterArn) {
    throw new TypeError('create requires a cluster ARN');
  }
  if (!instanceArn) {
    throw new TypeError('create requires an instance ARN');
  }

  function promiseToCreate() {
    return aws.ecs.registerContainerInstance({
      cluster: clusterArn,
      containerInstance: instanceArn
    })
    .then(R.prop('containerInstance'));
  }

  return promiseToCreate;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} cluster Name or ARN
 * @param {string} instanceArn
 * @returns {function(): Promise}
 */
function findOrCreate(aws, cluster, instanceArn) {

  function promiseToFindOrCreate() {
    return describeMany(aws, cluster, [instanceArn])()
      .then((instances) =>
        instances && instances.length
          ? instances[0]
          : create(aws, cluster, instanceArn)()
      );
  }

  return promiseToFindOrCreate;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} instanceArn
 * @param {string[]} clusterArn
 * @returns {function(): Promise.<Object[]>}
 */
 function describe(aws, clusterArn) {
  if (!clusterArn) {
    throw new TypeError('describeMany requires a cluster ARN');
  }

  function promiseToDescribe() {

    return list(aws, clusterArn)()
      .then((instanceArns) => describeMany(aws, clusterArn, instanceArns)());
  }

  return promiseToDescribe;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} cluster Cluster name or ARN
 * @param {string[]} containerInstances Array of instance id or ARN
 * @returns {function(): Promise.<Object[]>}
 */
function describeMany(aws, cluster, containerInstances) {
  if (!cluster) {
    throw new TypeError('describeMany requires a cluster ARN');
  }
  if (!containerInstances || !containerInstances.length) {
    throw new TypeError('describeMany requires a container instance ARN');
  }

  function promiseToDescribeMany() {
    const params = {
      cluster,
      containerInstances
    };
    return aws.ecs.describeContainerInstances(params)
      .then(R.prop('containerInstances'));
  }

  return promiseToDescribeMany;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} cluster
 * @param {string} containerInstance Instance id or ARN
 * @returns {function(): Promise.<string>}
 */
function destroy(aws, cluster, containerInstance) {
  if (!cluster) {
    throw new TypeError('destroy requires a cluster name or ARN');
  }
  if (!containerInstance) {
    throw new TypeError('destroy requires an instance id or ARN');
  }

  function promiseToDestroy() {
    return aws.ecs.deregisterContainerInstance({
      cluster,
      containerInstance
    })
    .then(() => 'deleted');
  }

  return promiseToDestroy;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} cluster
 * @param {string} containerInstance
 * @returns {function(): Promise.<string>}
 */
function findAndDestroy(aws, cluster, containerInstance) {

  function promiseToFindAndDestroy() {
    return describeMany(aws, cluster, [containerInstance])()
      .then((instances) =>
        instances && instances.length
          ? destroy(aws, cluster, containerInstance)()
          : 'already deleted'
      );
  }

  return promiseToFindAndDestroy;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} cluster name or ARN
 * @returns {function(): Promise.<string[]>}
 */
function list(aws, cluster) {
  if (!cluster) {
    throw new TypeError('list requires a cluster name or ARN');
  }

  function promiseToList() {
    return aws.ecs
      .listContainerInstances({
        cluster
      })
      .then(R.prop('containerInstanceArns'))
      .then((containerInstanceArns) => {
        if (containerInstanceArns) {
          return containerInstanceArns;
        }
        throw new Error('Containers: list with unexpected data');
      });
  }

  return promiseToList;
}
