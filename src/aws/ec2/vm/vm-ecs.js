'use strict';
/**
 * @module aws/ec2/vm-ecs
 * Creates AWS ECS Aware EC2 units (vm's)
 */

const awsConstants = require('../../aws-constants');
const util = require('../../../util');
const vmud = require('./vm-user-data');
const awsCommon = require('../../common');
// not a constant for testing purposes (imports fix this :) )
let tag = require('./../ec2-tag');
let vm = require('./vm');

module.exports = {
  addTags,
  removeTags,
  bindAws,
  create,
  createDeployment,
  createPr,
  describeDeployment: vm.describeDeployment,
  describePr: vm.describePr,
  destroy: vm.destroy,
  destroyDeployment: vm.destroyDeployment,
  destroyPr: vm.destroyPr,
  listDeployment: vm.listDeployment,
  listPr: vm.listPr,
  stageDeployment,
  stagePr,
  unStageDeployment,
  unStagePr
};

/**
 * @param {AwsWrapper} aws
 * @param {string} deployment
 * @param {Array.<string>} instanceIds
 * @returns {function(): Promise}
 */
function stageDeployment(aws, deployment, instanceIds) {
  
  function promiseToStageDeployment() {
    return addTags(aws, instanceIds, [
      tag.createDeployment(deployment)
    ])();
  }
  return promiseToStageDeployment;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} pr
 * @param {Array.<string>} instanceIds
 * @returns {function(): Promise}
 */
function stagePr(aws, pr, instanceIds) {

  function promiseToStagePr() {
    return addTags(aws, instanceIds, [
      tag.createPr(pr)
    ])();
  }
  return promiseToStagePr;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} deployment
 * @returns {function(): Promise.<Array.<string>>}
 */
function unStageDeployment(aws, projectId, deployment) {
  const list = vm.listDeployment(aws, projectId, deployment);

  function promiseToUnStageDeployment() {
    return list()
      .then((instances) => removeTags(aws, instances, [
        tag.createDeployment(deployment)
      ])().then(() => instances));
  }
  return promiseToUnStageDeployment;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} pr
 * @returns {function(): Promise.<Array.<string>>}
 */
function unStagePr(aws, projectId, pr) {
  const list = vm.listPr(aws, projectId, pr);

  function promiseToUnStagePr() {
    return list()
      .then((instances) => removeTags(aws, instances, [
        tag.createPr(pr)
      ])().then(() => instances));
  }
  return promiseToUnStagePr;
}

/**
 * @param {AwsWrapper} aws
 * @returns {Object} this API bound to
 */
function bindAws(aws) {
  return awsCommon.bindAws(aws, module.exports);
}

/**
 * @param {AwsWrapper} aws
 * @param {Array.<string>} instances
 * @param {Array.<Ec2Tag>} tags
 * @param {string=} label
 * @returns {function(): Promise}
 */
function addTags(aws, instances, tags, label) {
  const tagFn = tag.tag(aws, instances, tags);
  
  return util.makeRetryPromiseFunction(tagFn, 
    awsConstants.AWS_RETRY_LIMIT, 
    awsConstants.AWS_RETRY_DELAY, 
    awsConstants.AWS_RETRY_MULTIPLIER, 
    null, label); 
}

/**
 * @param {AwsWrapper} aws
 * @param {Array.<string>} instances
 * @param {Array.<Ec2Tag>} tags
 * @param {string=} label
 * @returns {function(): Promise}
 */
function removeTags(aws, instances, tags, label) {
  const tagFn = tag.unTag(aws, instances, tags);

  return util.makeRetryPromiseFunction(tagFn,
    awsConstants.AWS_RETRY_LIMIT,
    awsConstants.AWS_RETRY_DELAY,
    awsConstants.AWS_RETRY_MULTIPLIER,
    null, label);
}

/**
 * @param {AwsWrapper} aws
 * @param {string} sgId
 * @param {string} subnetId
 * @param {Array.<Ec2Tag>} tags
 * @param {string} userData (base64)
 * @returns {function(): Promise}
 * @private
 */
function create(aws, sgId, subnetId, tags, userData) {

  const createFn = vm.create(aws, sgId, subnetId, userData);
  const safeCreate = util.makeRetryPromiseFunction(
    createFn,
    awsConstants.AWS_RETRY_LIMIT,
    awsConstants.AWS_RETRY_DELAY,
    awsConstants.AWS_RETRY_MULTIPLIER,
    null,
    'create-ec2-ecs vm'
  );
  /**
   * @returns {Promise}
   * @private
   */
  function promiseToCreateDeployment_() {
    return safeCreate()
      .then((deployments) => addTags(aws, deployments, tags,
        'vm-ecs createDeployment')()
        .then(() => deployments));
  }
  return promiseToCreateDeployment_;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} clusterName
 * @param {string} projectId
 * @param {string} deployment
 * @param {string} sgId
 * @param {string} subnetId
 * @param {Array.<string>=} sshKeys
 * @returns {function(): Promise.<Array.<string>>}
 */
function createDeployment(aws, clusterName, projectId, deployment, 
                          sgId, subnetId, sshKeys) {
  const userData = vmud.getEcs(clusterName, sshKeys);
  const tags = [
    tag.createClusternator(),
    tag.createDeployment(deployment),
    tag.createName(clusterName),
    tag.createProject(projectId)
  ];

  /**
   * @returns {Promise.<Array.<string>>}
   */
  function promiseToCreateDeployment() {
    return vm.listDeployment(aws, projectId, deployment)()
      .then((deployments) => deployments.length ?
        deployments : 
        create(aws,  sgId, subnetId, tags, userData)());
  }
  return promiseToCreateDeployment;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} clusterName
 * @param {string} projectId
 * @param {string} pr
 * @param {string} sgId
 * @param {string} subnetId
 * @param {Array.<string>=} sshKeys
 * @returns {function(): Promise.<Array.<string>>}
 */
function createPr(aws, clusterName, projectId, pr, sgId, subnetId, 
                  sshKeys) {
  const userData = vmud.getEcs(clusterName, sshKeys);
  const tags = [
    tag.createClusternator(),
    tag.createPr(pr),
    tag.createName(clusterName),
    tag.createProject(projectId)
  ];

  /**
   * @returns {Promise.<Array.<string>>}
   */
  function promiseToCreateDeployment() {
    return vm.listPr(aws, projectId, pr)()
      .then((deployments) => deployments.length ?
        deployments :
        create(aws, sgId, subnetId, tags, userData)());
  }
  return promiseToCreateDeployment;
}
