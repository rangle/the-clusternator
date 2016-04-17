'use strict';
/**
 * Types for managing AWS EC2 SecurityGroups
 *
 * @module aws/ec2/sg/groups
 */

const filter = require('./../ec2-filter');
const tag = require('./../ec2-tag');
const constants = require('../../../constants');
const awsConstants = require('../../aws-constants');
const rid = require('../../../resource-identifier');
const util = require('../../../util');
const awsCommon = require('../../common');

const ipPerms = require('./security-groups-ip-permissions');
const ipRange = require('./security-group-ip-range');

module.exports = {
  bindAws,
  create,
  createDeployment,
  createPr,
  describe,
  describeDeployment,
  describePr,
  describeProject,
  destroy,
  destroyDeployment,
  destroyPr,
  list,
  listDeployment,
  listPr,
  listProject,
  authorizeEgress,
  authorizeIngress,
  helpers: {
    getDeploymentTags,
    getPrTags,
    tagPrOrDeployment
  }
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
 * @param {string} groupId
 * @param {SgIpPermissions[]} ipPermissions
 * @returns {function(): Promise}
 * @throws {TypeError}
 */
function authorizeIngress(aws, groupId, ipPermissions) {
  if (!Array.isArray(ipPermissions)) {
    throw new TypeError('authorizeIngress requires array of IP permissions');
  }

  function promiseToAuthorizeIngress() {
    return aws.ec2.authorizeSecurityGroupIngress({
      GroupId: groupId,
      IpPermissions: ipPermissions
    });

  }
  return promiseToAuthorizeIngress;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} groupId
 * @param {SgIpPermissions[]} ipPermissions
 * @returns {function(): Promise}
 * @throws {TypeError}
 */
function authorizeEgress(aws, groupId, ipPermissions) {
  if (!Array.isArray(ipPermissions)) {
    throw new TypeError('authorizeEgress requires array of IP permissions');
  }

  function promiseToAuthorizeEgress() {
    return aws.ec2.authorizeSecurityGroupEgress({
      GroupId: groupId,
      IpPermissions: ipPermissions
    });
  }

  return promiseToAuthorizeEgress;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} name
 * @param {string} description
 * @returns {function(): Promise<string>}
 */
function create(aws, name, description) {

  function promiseToCreate() {
    return aws.ec2
      .createSecurityGroup({
        GroupName: name,
        Description: description,
        VpcId: aws.vpcId
      })
      .then((result) => result.GroupId);
  }

  return promiseToCreate;
}

/**
 * @param {string} projectId
 * @param {string} pr
 * @returns {Array.<Ec2Tag>}
 */
function getPrTags(projectId, pr) {
  return [
    tag.createClusternator(),
    tag.createProject(projectId),
    tag.createPr(pr)
  ];
}

/**
 * @param {string} projectId
 * @param {string} pr
 * @return {string}
 */
function createPrName(projectId, pr) {
  return rid.generateRID({
    pid: projectId,
    pr: pr
  });
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} id
 * @param {string} typeId
 * @param {function(string, string): Array} getTagFunction
 * @returns {function(): Promise.<string>}
 */
function tagPrOrDeployment(aws, projectId, id, typeId, getTagFunction) {
  /**
   * @returns {Promise.<string>}
   */
  function promiseToTag() {
    return tag.tag(aws, [id], getTagFunction(projectId, typeId))()
      .then(() => authorizeIngress(aws, id, [
        ipPerms.create(-1, 1, 65534, [ipRange.create('0.0.0.0/0')])
      ])())
      .then(() => id);
  }
  return promiseToTag;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} id
 * @param {string} pr
 * @returns {function(): Promise.<string>}
 */
function tagPr(aws, projectId, id, pr) {
  const tagFn = tagPrOrDeployment(aws, projectId, id, pr, getPrTags);
  
  return util.makeRetryPromiseFunction(tagFn, 
    awsConstants.AWS_RETRY_LIMIT, 
    awsConstants.AWS_RETRY_DELAY, 
    awsConstants.AWS_RETRY_MULTIPLIER, 
    null, // @todo sometimes we might actually want to hard fail
    'Tag PR');
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} pr
 * @returns {function(): Promise<string>}
 */
function createPr(aws, projectId, pr) {
  const id = createPrName(projectId, pr);

  function promiseToCreatePr() {
    return listPr(aws, projectId, pr)()
      .then((r) => r.length ? r[0] : create(
        aws, id, `Created by The Clusternator For ${projectId} PR #${pr}`)()
        .then((id) => tagPr(aws, projectId, id, pr)()));
  }

  return promiseToCreatePr;
}

/**
 * @param {string} projectId
 * @param {string} deployment
 * @returns {Array.<Ec2Tag>}
 */
function getDeploymentTags(projectId, deployment) {
  return [
    tag.createClusternator(),
    tag.createProject(projectId),
    tag.createDeployment(deployment)
  ];
}

/**
 * @param {string} projectId
 * @param {string} deployment
 * @returns {string}
 */
function createDeploymentName(projectId, deployment) {
  return rid.generateRID({
    pid: projectId,
    deployment: deployment
  });
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} id
 * @param {string} deployment
 * @returns {function(): Promise.<string>}
 */
function tagDeployment(aws, projectId, id, deployment) {
  const tagFn =  tagPrOrDeployment(
    aws, projectId, id, deployment, getDeploymentTags);
  
  return util.makeRetryPromiseFunction(tagFn,
    awsConstants.AWS_RETRY_LIMIT,
    awsConstants.AWS_RETRY_DELAY,
    awsConstants.AWS_RETRY_MULTIPLIER,
    null, // @todo sometimes we might actually want to hard fail
    'Tag Deployment');
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} deployment
 * @returns {function(): Promise<string>}
 */
function createDeployment(aws, projectId, deployment) {
  const id = createDeploymentName(projectId, deployment);

  function promiseToCreateDeployment() {
    return listDeployment(aws, projectId, deployment)()
      .then((r) => r.length ? r[0] : create(
        aws, id, `Created by The Clusternator For ${projectId} deployment ` +
        deployment)()
        .then((id) => tagDeployment(aws, projectId, id, deployment)()));
  }

  return promiseToCreateDeployment;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} groupId
 * @returns {function(): Promise.<string>}
 */
function destroy(aws, groupId) {

  function promiseToDestroy() {
    return aws.ec2.deleteSecurityGroup({
      GroupId: groupId
    }).then(() => 'deleted');
  }

  return promiseToDestroy;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} deployment
 * @returns {function(): Promise.<string>}
 */
function destroyDeployment(aws, projectId, deployment) {

  function promiseToDestroyDeployment() {
    return listDeployment(aws, projectId, deployment)()
      .then((r) => r.length ? destroy(aws, r[0])() : 'already deleted');
  }

  return util.makeRetryPromiseFunction(
    promiseToDestroyDeployment, 
    awsConstants.AWS_RETRY_LIMIT + 2,  // security groups are stubborn
    awsConstants.AWS_RETRY_DELAY, 
    awsConstants.AWS_RETRY_MULTIPLIER, 
    null, 
    'Security Group PR Destroy'
  );
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} pr
 * @returns {function(): Promise.<string>}
 */
function destroyPr(aws, projectId, pr) {

  function promiseToDestroyPr() {
    return listPr(aws, projectId, pr)()
      .then((r) => r.length ? destroy(aws, r[0])() : 'already deleted');
  }

  return util.makeRetryPromiseFunction(
    promiseToDestroyPr,
    awsConstants.AWS_RETRY_LIMIT + 2, // security groups are stubborn
    awsConstants.AWS_RETRY_DELAY,
    awsConstants.AWS_RETRY_MULTIPLIER,
    null,
    'Security Group PR Destroy'
  );
}

/**
 * @param {AwsWrapper} aws
 * @returns {function(): Promise.<{ SecurityGroups: Array }>}
 */
function describe(aws) {

  function promiseToDescribe() {
    return aws.ec2.describeSecurityGroups({
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
 * @param {string} projectId
 * @returns {function(): Promise.<{ SecurityGroups: Array }> }
 */
function describeProject(aws, projectId) {

  function promiseToDescribeProject() {
    return aws.ec2.describeSecurityGroups({
      Filters: [
        filter.createVpc(aws.vpcId),
        filter.createClusternator(),
        filter.createTag(constants.PROJECT_TAG, projectId)
      ]
    });
  }

  return promiseToDescribeProject;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} pr
 * @returns {function(): Promise.<{ SecurityGroups: Array }> }
 */
function describePr(aws, projectId, pr) {

  function promiseToDescribePr() {
    return aws.ec2.describeSecurityGroups({
      Filters: [
        filter.createSgName(createPrName(projectId, pr))
      ]
    });
  }

  return promiseToDescribePr;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} deployment
 * @returns {function(): Promise.<{ SecurityGroups: Array }> }
 */
function describeDeployment(aws, projectId, deployment) {

  function promiseToDescribeDescribeDeployment() {
    return aws.ec2.describeSecurityGroups({
      Filters: [
        filter.createSgName(createDeploymentName(projectId, deployment))
      ]
    });
  }

  return promiseToDescribeDescribeDeployment;
}

/**
 * @param {Object} el
 * @returns {string}
 */
function mapDescription(el) {
  return el.GroupId;
}

/**
 * @param {Array} descriptions
 * @returns {Array}
 */
function mapDescribeToGroupIds(descriptions) {
  return descriptions.map(mapDescription);
}

/**
 * @param {AwsWrapper} aws
 * @returns {function(): Promise<string[]>}
 */
function list(aws) {

  function promiseToList() {
    return describe(aws)()
      .then((result) => mapDescribeToGroupIds(result.SecurityGroups));
  }

  return promiseToList;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @returns {function(): Promise<string[]>}
 */
function listProject(aws, projectId) {

  function promiseToListProject() {
    return describeProject(aws, projectId)()
      .then((result) => mapDescribeToGroupIds(result.SecurityGroups));
  }

  return promiseToListProject;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} pr
 * @returns {function(): Promise<string[]>}
 */
function listPr(aws, projectId, pr) {

  function promiseToListPr() {
    return describePr(aws, projectId, pr)()
      .then((result) => mapDescribeToGroupIds(result.SecurityGroups));
  }

  return promiseToListPr;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} deployment
 * @returns {function(): Promise<string[]>}
 */
function listDeployment(aws, projectId, deployment) {

  function promiseToListDeployment() {
    return describeDeployment(aws, projectId, deployment)()
      .then((result) => mapDescribeToGroupIds(result.SecurityGroups));
  }

  return promiseToListDeployment;
}
