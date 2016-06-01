'use strict';
/**
 * Encapsulates functions required to build deployments on AWS
 *
 * @module aws/deploymentManager
 */
const Q = require('q');
const Subnet = require('./subnetManager');
const SG = require('./ec2/security-groups/security-groups');
const ec2Fns = require('./ec2/vm/vm-ecs');
const rid = require('./../resource-identifier');
const Cluster = require('./clusterManager');
const Route53 = require('./route53Manager');
const Task = require('./taskServiceManager');
const common = require('./common');
const constants = require('../constants');
const awsConstants = require('./aws-constants');
const path = require('path');
const util = require('../util');
const elbFns = require('./elb/elb');
const Config = require('../config');

function getDeploymentManager(ec2, ecs, r53, awsElb, vpcId, zoneId) {
  const AWS = {
    ec2: util.makePromiseApi(ec2),
    elb: util.makePromiseApi(awsElb),
    vpcId 
  };
  const subnet = Subnet(ec2, vpcId);
  const securityGroup = SG.bindAws(AWS);
  const cluster = Cluster(ecs);
  const route53 = Route53(r53, zoneId);
  const ec2mgr = ec2Fns.bindAws(AWS);
  const task = Task(ecs);
  const elb = elbFns.bindAws(AWS);

  /**
   * @param {Object} creq
   * @returns {Promise.<{ instances: Array.<string> }>}
   */
  function createEc2(creq) {
    return ec2mgr
      .createDeployment(
        creq.clusterNameNew,
        creq.projectId,
        creq.deployment,
        creq.groupId,
        creq.subnetId,
        creq.sshData
      )()
      .then((instances) => {
        creq.instances = instances;
        return creq;
      });
  }

  function createElb(creq) {
    return elb.createDeployment(creq.projectId, creq.deployment, creq.subnetId,
      creq.groupId, awsConstants.AWS_SSL_ID, creq.useInternalSSL)()
      .then((results) => {
        creq.dns = results.dns;
        creq.elbId = results.id;
        return setUrl(creq);
      });
  }

  function setUrl(creq) {
    return route53
      .createDeploymentCNameRecord(creq.projectId, creq.deployment, creq.dns)
      .then((r53result) => {
        creq.url = r53result;
        return creq;
      });
  }


  /**
   * @param {Object} creq
   * @returns {Promise<{ groupId: string }>}
   */
  function setGroupId(creq) {
    return securityGroup
      .createDeployment(creq.projectId, creq.deployment)()
      .then((groupId) => {
        creq.groupId = groupId;
        return creq;
      });
  }


  /**
   * @param {string} projectId
   * @param {string} deployment
   * @param {Object} appDef
   * @param {*=} sshData
   * @returns {Request|Promise.<T>|*}
   */
  function create(projectId, deployment, appDef, sshData) {
    const clusterName = rid.generateRID({ pid: projectId, deployment });
    const creq = {
      projectId,
      deployment,
      appDef,
      sshData,
      clusterNameNew: clusterName
    };

    return common
      .setSubnet(subnet, creq)
      .then(() => Q
        .all([
          setGroupId(creq),
          cluster.create(clusterName) ])
        .then(() => creq))
      .then(() => common.createElbEc2(createElb, createEc2, creq))
      .then(() => common.createTask(task, creq))
      .then(() => common.registerEc2ToElb(elb, creq))
      .then((creq) => common.qualifyUrl(Config(), creq.url));

  }

  /**
   * @param {{ elbId: string, instanceIds: Array.<string>, deployment: string, 
   clusterNameExisting: string, projectId: string }} creq
   * @returns {Promise.<Promise.<Object>>}
   */
  function updateDestroy(creq) {
    return elb.deRegisterInstances(creq.elbId, creq.instanceIds)()
      .then(() => common.destroyEc2Manual(ec2mgr, cluster,
        creq.clusterNameExisting, creq.instanceIds)
        .then((r) => task
          .destroy(creq.clusterNameExisting)
          .fail((err) => {
            util.info(`PR Problem Destroying Task: ${err.message}`);
            return r;
          }))
        /**
         * @todo we don't have to destroy this cluster, there is a better way,
         * this is a temporary solution.  @rafkhan knows the cluster update
         * story best and also knows its issues at the moment
         */
        .then(() => cluster
          .destroy(creq.clusterNameExisting)
          .fail(() => undefined)));
  }

  /**
   * @param {string} projectId
   * @param {string} deployment
   * @param {Object} appDef
   * @param {string[]|string} sshKeys
   * @param {string} elbId
   * @param {string[]} instanceIds
   * @returns {Promise}
   */
  function update(projectId, deployment, appDef, sshKeys, elbId, instanceIds) {
    const clusterName = rid.generateRID({ pid: projectId, deployment });
    const creq = {
      appDef,
      elbId,
      sshData: sshKeys || '',
      instanceIds,
      deployment,
      projectId
    };

    return common.zduClusterNamesCreq(creq, cluster, task, clusterName)
      .then((result) => {
        creq.clusterNameExisting = result.clusterNameExisting;
        creq.clusterNameNew = result.clusterNameNew;
        return creq;
      })
      .then(() => ec2mgr.unStageDeployment(projectId, deployment)())
      .then(() => common
        .setSubnet(subnet, creq)
        .then(() => Q
          .all([
            setGroupId(creq),
            cluster.create(creq.clusterNameNew)
          ])
          .then(() => creq))
        .then(() => createEc2(creq))
        .then(() => common.createTask(task, creq))
        .then(() => common.registerEc2ToElb(elb, creq))
        .then(() => {
          creq.url = route53.generateDeploymentDomain(projectId, deployment);
          return creq;
        }))
      .then(() => updateDestroy(creq))
      .then(() => common.qualifyUrl(Config(), creq.url));
  }
  
  /**
   * @param {string} projectId
   * @param {string} deployment
   * @param {string} clusterName
   * @returns {Promise.<string[]>}
   */
  function destroyEc2(projectId, deployment, clusterName) {
    if (!clusterName) {
      throw new Error('destroyEc2: requires valid clusterName');
    }
    return cluster
      .listContainers(clusterName)
      .then((result) => Q
        .all(result.map(common.getDeregisterClusterFn(cluster, clusterName)))
        .then(() => ec2mgr
          .destroyDeployment(projectId, deployment)()
          .fail((err) => {
            util.info('Deployment Destruction Problem Destroying ec2Fns: ' +
              err.message);
          })));
  }

  /**
   * @param {string} projectId
   * @param {string} deployment
   * @returns {Request|Promise.<T>}
   */
  function destroyRoutes(projectId, deployment) {
    return elb.describeDeployment(projectId, deployment)()
      .then((result) => route53
        .destroyDeploymentCNameRecord(projectId, deployment, result.dns));
  }

  function destroyElb(projectId, deployment) {
    return elb.destroyDeployment(projectId, deployment)()
      //fail over
      .fail((err) => util.warn(err));
  }

  /**
   * @param {string} projectId
   * @param {string} deployment
   * @returns {Request}
   */
  function destroy(projectId, deployment) {
    const clusterName = rid.generateRID({
      pid: projectId,
      deployment
    });
    const creq = {};
    return common.zduClusterNamesCreq(creq, cluster, task, clusterName)
      .then(() => destroyRoutes(projectId, deployment)
        .then(() => destroyEc2(projectId, deployment, creq.clusterNameExisting),
          () => destroyEc2(projectId, deployment, creq.clusterNameExisting))
        .then(() => destroyElb(projectId, deployment))
        .then((r) => task
          .destroy(creq.clusterNameExisting)
          .fail((err) => {
            util.info('Deployment Destruction Problem Destroying Task: ' +
              err.message);
          }))
        .then(() => cluster
          .destroy(creq.clusterNameExisting)
          // fail over
          .fail(() => undefined))
        .then(() => securityGroup
          .destroyDeployment(projectId, deployment)()
          // fail over
          .fail(() => undefined)));
  }


  return {
    create,
    destroy,
    update
  };
}

module.exports = getDeploymentManager;
