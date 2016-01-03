'use strict';

const Subnet = require('./subnetManager');
const iamWrap = require('./iam/iam');
const Route = require('./routeTableManager');
const Route53 = require('./route53Manager');
const Acl = require('./aclManager');
const Cluster = require('./clusterManager');
const Pr = require('./prManager');
const Ec2 = require('./ec2Manager');
const Deployment = require('./deploymentManager');
const DynamoManager = require('./dynamoManager');
const gpg = require('../cli-wrappers/gpg');
const constants = require('../constants');
const util = require('../util');
const Q = require('q');
const R = require('ramda');

var Vpc = require('./vpcManager');

function getProjectManager(ec2, ecs, awsRoute53, dynamoDB, awsIam) {
  var vpcId = null;
  var pullRequest;
  var cluster;
  var deployment;
  var vpc = Vpc(ec2);
  var r53 = Route53(awsRoute53);
  var ddbManager = DynamoManager(dynamoDB);
  var ec2mgr;
  var route;
  var subnet;
  var acl;

  const iam = R.mapObjIndexed(iamAwsPartial, iamWrap);

  function iamAwsPartial(fn) {
    return R.partial(fn, { iam: util.makePromiseApi(awsIam) });
  }

  function destroy(pid) {
    return ec2.describeProject(pid).then((list) => {
      if (list.length) {
        throw new Error('ProjectManager: Cannot destroy project while open ' +
          'pull requests exist');
      }
      return subnet.destroy(pid).then(() => {
          return acl.destroy(pid);
      });
    });
  }

  /**
   * @param {string} pid
   * @returns {Request|Promise.<T>}
   */
  function create(pid) {
    return Q.all([
      route.findDefault(),
      acl.create(pid)
    ]).then((results) => {
      var routeId = results[0].RouteTableId,
        aclId = results[1].NetworkAcl.NetworkAclId;

      return subnet.create(pid, routeId, aclId);
    });
  }

  /**
   * @param {string} pid
   * @returns {Request}
   */
  function findOrCreateProject(pid) {
    return create(pid).then((sDesc) => {
      return sDesc;
    }, () => {
      return subnet.findProject();
    });
  }

  /**
   * @param {string} pid
   * @param {string} pr
   * @param {Object} appDef
   * @param {Object=} sshData
   * @returns {Q.Promise}
   */
  function createPR(pid, pr, appDef, sshData) {
    return findOrCreateProject(pid)
      .then((snDesc) => {
        return pullRequest
          .create(pid, pr, appDef, sshData);
      });
  }

  /**
   * @param {string} pid
   * @param {string} pr
   * @returns {Q.Promise}
   */
  function destroyPR(pid, pr) {
    return pullRequest.destroy(pid, pr);
  }

  /**
   * @param {string} pid
   * @param {string} dep
   * @param {string} sha
   * @param {Object} appDef
   * @returns {Q.Promise}
   */
  function createDeployment(pid, dep, sha, appDef) {
    return findOrCreateProject(pid).then((snDesc) => {
      return deployment.create( pid, dep, sha, appDef );
    });
  }

  /**
   * @param {string} pid
   * @param {string} dep
   * @param {string} sha
   * @returns {Request}
   */
  function destroyDeployment(pid, dep, sha) {
    return findOrCreateProject(pid).then((snDesc) => {
      return deployment.destroy( pid, dep, sha);
    });
  }

  function describeProject(pid) {
    return cluster.describeProject(pid);
  }


  function initializeGithubWebhookToken(pid) {
    return gpg.generatePass()
      .then((passphrase) => {
        var item = {
          ProjectName: { S: pid },
          GithubSecretToken: { S: passphrase }
        };

        return ddbManager
          .insertItem(ddbManager.tableNames.GITHUB_AUTH_TOKEN_TABLE, item)
          .then(() => {
            return passphrase;
          }, Q.reject);
      }, Q.reject);
  }

  function listProjects() {
    return subnet.describe().then((dBlock) => {
      return dBlock.map((block) => {
        return block.Tags;
      });
    }).then((tags) => {
      return tags.map((tagGroup) => {
        var result = null;
        tagGroup.forEach((tag) => {
          if (tag.Key === constants.PROJECT_TAG) {
            result = tag.Value;
          }
        });
        return result;
      }).filter((identity) => {
        return identity;
      });
    });
  }


  return Q.all([
     vpc.findProject(),
     r53.findId()
  ]).then((results) => {
    var vDesc = results[0],
    zoneId = results[1];

    cluster = Cluster(ecs);
    vpcId = vDesc.VpcId;
    route = Route(ec2, vpcId);
    subnet = Subnet(ec2, vpcId);
    acl = Acl(ec2, vpcId);
    pullRequest = Pr(ec2, ecs, awsRoute53, vpcId, zoneId);
    deployment = Deployment(ec2, ecs, awsRoute53, vpcId, zoneId);
    ec2mgr = Ec2(ec2, vpcId);
    return {
      create,
      createPR,
      createDeployment,
      destroy,
      destroyPR,
      destroyDeployment,
      describeProject,
      listProjects,

      deployment,
      pr: pullRequest,
      ec2: ec2mgr,
      iam,
      initializeGithubWebhookToken
    };
  });


}

module.exports = getProjectManager;
