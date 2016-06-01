'use strict';
/**
 * Functions to encapsulate assembling a PR
 *
 * @module aws/prManager
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
const path = require('path');
const constants = require('../constants');
const awsConstants = require('./aws-constants');
const util = require('../util');
const elbFns = require('./elb/elb');
const Config = require('../config');

function getPRManager(ec2, ecs, r53, awsElb, vpcId, zoneId) {
  const AWS = {
    ec2: util.makePromiseApi(ec2),
    elb: util.makePromiseApi(awsElb),
    vpcId 
  };
  let subnet = Subnet(ec2, vpcId);
  let securityGroup = SG.bindAws(AWS);
  let cluster = Cluster(ecs);
  let route53 = Route53(r53, zoneId);
  let ec2mgr = ec2Fns.bindAws(AWS);
  let task = Task(ecs);
  let config = require('../config')();
  const elb = elbFns.bindAws(AWS);

  /**
   * @param {Object} creq
   * @returns {Promise.<{ instances: Array.<string> }>}
   */
  function createEc2(creq) {
    return ec2mgr
      .createPr(
        creq.clusterNameNew,
        creq.projectId,
        creq.pr,
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
    return elb.createPr(creq.projectId, creq.pr, creq.subnetId,
      creq.groupId, awsConstants.AWS_SSL_ID)()
      .then((results) => {
        creq.dns = results.dns;
        creq.elbId = results.id;
        return setUrl(creq);
      });
  }

  function setUrl(creq) {
    return route53
      .createPRCNameRecord(creq.projectId, creq.pr, creq.dns)
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
      .createPr(creq.projectId, creq.pr)()
      .then((groupId) => {
        creq.groupId = groupId;
        return creq;
      });
  }

  /**
   * @param {string} projectId
   * @param {string} pr
   * @param {Object} appDef
   * @param {string[]|string} sshKeys
   * @returns {Request|Promise.<T>|*}
   */
  function create(projectId, pr, appDef, sshKeys) {
    const clusterName =rid.generateRID({ pid: projectId, pr });
    const creq = {
      projectId,
      pr: pr + '',
      appDef,
      sshData: sshKeys || '',
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
   * @param {{ elbId: string, instanceIds: Array.<string>, pr: string, 
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
   * @param {string} pr
   * @param {Object} appDef
   * @param {string[]|string} sshKeys
   * @param {string} elbId
   * @param {string[]} instanceIds
   * @returns {Promise}
   */
  function update(projectId, pr, appDef, sshKeys, elbId, instanceIds) {
    const clusterName = rid.generateRID({ pid: projectId, pr });
    const creq = {
      appDef,
      elbId,
      sshData: sshKeys || '',
      instanceIds,
      pr: pr + '',
      projectId
    };

    return common.zduClusterNamesCreq(creq, cluster, task, clusterName)
      .then(() => ec2mgr.unStagePr(projectId, pr)())
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
          creq.url = route53.generatePRDomain(projectId, pr);
          return creq;
        }) )
      .then(() => updateDestroy(creq))
      .then(() => common.qualifyUrl(Config(), creq.url));
  }

  /**
   * @param {string} projectId
   * @param {string} pr
   * @param {string} clusterName
   * @returns {Promise.<string[]>}
   */
  function destroyEc2(projectId, pr, clusterName) {
    if (!clusterName) {
      throw new Error('destroyEc2: requires valid clusterName');
    }
    return cluster
      .listContainers(clusterName)
      .then((result) => Q
        .all(result.map(common.getDeregisterClusterFn(cluster, clusterName)))
        .then(() => ec2mgr
          .destroyPr(projectId, pr)()
          .fail((err) => util
            .info(`PR Destruction Problem Destroying Ec2: ${err.message}`))
        )
      );
  }

  /**
   * @param {string} projectId
   * @param {string} pr
   * @returns {Request|Promise.<T>}
   */
  function destroyRoutes(projectId, pr) {
    return elb.describePr(projectId, pr)()
      .then((result) => route53
        .destroyPRCNameRecord(projectId, pr, result.dns));
  }

  /**
   * @param {string} projectId
   * @param {string} pr
   * @returns {Q.Promise}
   */
  function destroyElb(projectId, pr) {
    return elb.destroyPr(projectId, pr)()
      //fail over
      .fail((err) => util.warn(err));
  }

  /**
   * @param {string} projectId
   * @param {string} pr
   * @returns {Request}
   */
  function destroy(projectId, pr) {
    const clusterName = rid.generateRID({
      pid: projectId,
      pr: pr
    });
    const creq = {};

    return common.zduClusterNamesCreq(creq, cluster, task, clusterName)
      .then(() => destroyRoutes(projectId, pr)
        .then(() => destroyEc2(projectId, pr, creq.clusterNameExisting),
          () => destroyEc2(projectId, pr, creq.clusterNameExisting))
        .then(() => destroyElb(projectId, pr))
        .then((r) => task
          .destroy(creq.clusterNameExisting)
          .fail((err) => {
            util.info(`PR Destruction Problem Destroying Task: ${err.message}`);
            return r;
          }))
        .then(() => cluster
          .destroy(creq.clusterNameExisting)
          .fail(() => undefined))
        .then(() => securityGroup
          .destroyPr(projectId, pr)()));
  }

  return {
    create,
    destroy,
    update
  };
}

module.exports = getPRManager;
