'use strict';

const filter = require('./ec2-filter');
const constants = require('../../constants');

module.exports = {
  create,
  destroy,
  describe,
  describeProject,
  describePr,
  describeDeployment,
  list,
  listProject,
  listPr,
  listDeployment,
  authorizeEgress,
  authorizeIngress
};

/**
 * @param {AwsWrapper} aws
 * @param {string} groupId
 * @param {SgIpPermissions[]} ipPermissions
 * @returns {Q.Promise}
 * @throws {TypeError}
 */
function authorizeIngress(aws, groupId, ipPermissions) {
  if (!Array.isArray(ipPermissions)) {
    throw new TypeError('authorizeIngress requires array of IP permissions');
  }

  return aws.ec2.authorizeSecurityGroupIngress({
    GroupId: groupId,
    IpPermissions: ipPermissions
  });
}

/**
 * @param {AwsWrapper} aws
 * @param {string} groupId
 * @param {SgIpPermissions[]} ipPermissions
 * @returns {Q.Promise}
 * @throws {TypeError}
 */
function authorizeEgress(aws, groupId, ipPermissions) {
  if (!Array.isArray(ipPermissions)) {
    throw new TypeError('authorizeEgress requires array of IP permissions');
  }
  return aws.ec2.authorizeSecurityGroupEgress({
    GroupId: groupId,
    IpPermissions: ipPermissions
  });
}

/**
 * @param {AwsWrapper} aws
 * @param {string} name
 * @param {string} description
 * @returns {Q.Promise<string>}
 */
function create(aws, name, description) {
  return aws.ec2
    .createSecurityGroup({
      GroupName: name,
      Description: description,
      VpcId: aws.vpcId })
    .then((result) => result.GroupId);
}

/**
 * @param {AwsWrapper} aws
 * @param {string} groupId
 * @returns {Q.Promise}
 */
function destroy(aws, groupId) {
  return aws.ec2.deleteSecurityGroup({
    GroupId: groupId
  });
}

function describe(aws) {
  return aws.ec2.describeSecurityGroups({
    Filters: [
      filter.createVpc(aws.vpcId),
      filter.createClusternator()
    ]
  });
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @returns {Q.Promise}
 */
function describeProject(aws, projectId) {
  return aws.ec2.describeSecurityGroups({
    Filters: [
      filter.createVpc(aws.vpcId),
      filter.createClusternator(),
      filter.createTag(constants.PROJECT_TAG, projectId)
    ]
  });
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} pr
 * @returns {Q.Promise}
 */
function describePr(aws, projectId, pr) {
  return aws.ec2.describeSecurityGroups({
    Filters: [
      filter.createVpc(aws.vpcId),
      filter.createClusternator(),
      filter.createTag(constants.PROJECT_TAG, projectId),
      filter.createTag(constants.PR_TAG, pr + '')
    ]
  });
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} deployment
 * @returns {Q.Promise}
 */
function describeDeployment(aws, projectId, deployment) {
  return aws.ec2.describeSecurityGroups({
    Filters: [
      filter.createVpc(aws.vpcId),
      filter.createClusternator(),
      filter.createTag(constants.PROJECT_TAG, projectId),
      filter.createTag(constants.DEPLOYMENT_TAG, deployment)
    ]
  });
}

/**
 * @param {Object} el
 * @returns {string}
 */
function mapDescribeToGroupIds(el) {
  return el.GroupId;
}

/**
 * @param {AwsWrapper} aws
 * @returns {Q.Promise<string[]>}
 */
function list(aws) {
  return describe(aws)
    .then((result) => mapDescribeToGroupIds(result.SecurityGroups));
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @returns {Q.Promise<string[]>}
 */
function listProject(aws, projectId) {
  return describeProject(aws, projectId)
    .then((result) => mapDescribeToGroupIds(result.SecurityGroups));
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} pr
 * @returns {Q.Promise<string[]>}
 */
function listPr(aws, projectId, pr) {
  return describePr(aws, projectId, pr)
    .then((result) => mapDescribeToGroupIds(result.SecurityGroups));
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} deployment
 * @returns {Q.Promise<string[]>}
 */
function listDeployment(aws, projectId, deployment) {
  return describeDeployment(aws, projectId, deployment)
    .then((result) => mapDescribeToGroupIds(result.SecurityGroups));
}
