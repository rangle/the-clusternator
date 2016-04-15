'use strict';
/**
 * Simplifies dealing with AWS clusters
 *
 * @module aws/ecs/clusters
 */
const R = require('ramda');
const Q = require('q');

const common = require('../common');
const util = require('../../util');
const awsUtil = require('../aws-util');
const taskServices = require('./task-services');

module.exports = {
  bindAws,
  create: findOrCreate,
  describeOne,
  describeMany,
  describeDeployment,
  describePr,
  describeProject,
  destroy: findAndDestroy,
  list,
  listDeployment,
  listPr,
  listProject,
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
 * Creates a cluster
 * @param {AwsWrapper} aws
 * @param {string} clusterName
 * @returns {function(): Promise}
 */
function create(aws, clusterName) {
  if (!clusterName) {
    throw new TypeError('create requires a cluster name');
  }

  function promiseToCreate() {
    return aws.ecs.createCluster({
      clusterName
    })
    .then(R.prop('cluster'));
  }

  return promiseToCreate;
}

/**
 * Finds or creates a cluster
 *
 * @param {AwsWrapper} aws
 * @param {string} clusterName
 * @returns {function(): Promise}
 */
function findOrCreate(aws, clusterName) {

  function promiseToFindOrCreate() {
    return describeMany(aws, [clusterName])()
      .then((clusters) =>
        clusters && clusters.length
          ? clusters[0]
          : create(aws, clusterName)()
      );
  }

  return promiseToFindOrCreate;
}

/**
 * Get information on a cluster
 *
 * @param {AwsWrapper} aws
 * @param {string} cluster Cluster name or ARN
 */
function describeOne(aws, cluster) {
  if (!cluster) {
    throw new TypeError('describeOne requires a cluster ARN');
  }

  function promiseToDescribeOne() {
    return describeMany(aws, [cluster])()
      .then(function(clusters) {
        const cluster = R.propOr(null, 0, clusters);

        if (!cluster) {
          throw new Error('Cluster does not exist');
        }

        return cluster;
      });
  }

  return promiseToDescribeOne;
}

/**
 * Get information on an array of clusters
 *
 * @param {AwsWrapper} aws
 * @param {string} clusters Clusters by name or ARN
 */
function describeMany(aws, clusters) {
  if (!clusters || !clusters.length) {
    throw new TypeError('describeMany requires '
      + 'an array of cluster name or ARN');
  }

  function promiseToDescribeMany() {
    return aws.ecs
      .describeClusters({
        clusters
      })
      .then(R.prop('clusters'));
  }

  return promiseToDescribeMany;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @returns {funciton(): Promise<Array>}
 */
function describeProject(aws, projectId) {
  if(!projectId) {
    throw new TypeError('describeProject requires a projectId');
  }

  function promiseToDescribeProject () {
    return listProject(aws, projectId)()
      .then(
        R.map((clusterArn) => taskServices.describe(aws, clusterArn)())
      )
      .then(Q.all);
  }

  return promiseToDescribeProject;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} pr
 * @returns {funciton(): Promise<Array>}
 */
function describePr(aws, projectId, pr) {
  if(!projectId) {
    throw new TypeError('describePr requires a projectId');
  }
  if(!pr) {
    throw new TypeError('describePr requires a PR');
  }

  function promiseToDescribePr() {
    return listPr(aws, projectId, pr)()
      .then(
        R.map((clusterArn) => taskServices.describe(aws, clusterArn)())
      )
      .then(Q.all);
  }

  return promiseToDescribePr;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} deployment
 * @returns {funciton(): Promise<Array>}
 */
function describeDeployment(aws, projectId, deployment) {
  if(!projectId) {
    throw new TypeError('describeDeployment requires a projectId');
  }
  if(!deployment) {
    throw new TypeError('describeDeployment requires a deployment');
  }

  function promiseToDescribeDeployment() {
    return listDeployment(aws, projectId, deployment)()
      .then(
        R.map((clusterArn) => taskServices.describe(aws, clusterArn)())
      )
      .then(Q.all);
  }

  return promiseToDescribeDeployment;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} cluster Cluster name or ARN
 * @returns {function(): Promise}
 */
function destroy(aws, cluster) {
  if (!cluster) {
    throw new TypeError('destroy requires cluster name or ARN');
  }

  function promiseToDestroy() {
    return aws.ecs.deleteCluster({
      cluster
    })
    .then(() => 'deleted');
  }

  return promiseToDestroy;
}

/**
 * Finds then destroys a cluster
 *
 * @param {AwsWrapper} aws
 * @param {string} cluster Cluster name or ARN
 * @returns {function(): Promise}
 */
function findAndDestroy(aws, cluster) {

  function promiseToFindAndDestroy() {
    return describeMany(aws, [cluster])()
      .then((clusters) =>
        clusters && clusters.length
          ? destroy(aws, cluster)()
          : 'already deleted'
      );
  }

  return promiseToFindAndDestroy;
}

/**
 * List all clusters
 * @param {AwsWrapper} aws
 * @return {function(): Promise.<string[]>}
 */
function list(aws) {

  function promiseToList() {
    return aws.ecs.listClusters({})
      .then(R.prop('clusterArns'))
      .then(R.filter(common.filterValidArns));
  }

  return promiseToList;
}

/**
 * List all clusters in project
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @return {function(): Promise.<string[]>}
 */
function listProject(aws, projectId) {
  if(!projectId) {
    throw new TypeError('listProject requires a projectId');
  }

  function promiseToListProject() {
    return list(aws)()
      .then(R.filter(common.getProjectIdFilter(projectId)));
  }

  return promiseToListProject;
}

/**
 * List all clusters in PR
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} pr
 * @return {function(): Promise.<string[]>}
 */
function listPr(aws, projectId, pr) {
  if(!projectId) {
    throw new TypeError('listPr requires a projectId');
  }
  if(!pr) {
    throw new TypeError('listPr requires a PR');
  }

  function promiseToListPr() {
    return list(aws)()
      .then(R.filter(common.getPrFilter(projectId, pr)));
  }

  return promiseToListPr;
}

/**
 * List all clusters in deployment
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} deployment
 * @return {function(): Promise.<string[]>}
 */
function listDeployment(aws, projectId, deployment) {
  if(!projectId) {
    throw new TypeError('listDeployment requires a projectId');
  }
  if(!deployment) {
    throw new TypeError('listDeployment requires a deployment');
  }

  function promiseToListDeployment() {
    return list(aws)()
      .then(R.filter(common.getDeploymentFilter(projectId, deployment)));
  }

  return promiseToListDeployment;
}
