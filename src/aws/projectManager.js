'use strict';
/**
 * Primary interface for dealing with AWS resources
 *
 * @module aws/projectManager
 */

const Subnet = require('./subnetManager');
const ecrWrap = require('./ecr/ecr');
const hashTable = require('./ddb/hash-table');
const iamWrap = require('./iam/iam');
// const Route = require('./routeTableManager');
const Route = require('./ec2/route-table');
const Route53 = require('./route53Manager');
const Acl = require('./aclManager');
const Cluster = require('./clusterManager');
const Pr = require('./prManager');
const Ec2 = require('./ec2/vm/vm');
const Deployment = require('./deploymentManager');
const constants = require('../constants');
const util = require('../util');
const Q = require('q');
const R = require('ramda');
const DEFAULT_REGION = 'us-east-1';
const elbLib = require('./elb/elb');

const Vpc = require('./ec2/vpc');

function getProjectManager(ec2, ecs, awsRoute53, dynamoDB, awsIam, awsEcr,
                           elb) {

  const promisifiedEc2 = util.makePromiseApi(ec2);
  const cluster = Cluster(ecs);
  const vpc = Vpc.bindAws({ ec2: promisifiedEc2 });
  const r53 = Route53(awsRoute53);

  const ht = hashTable.bindAws({ ddb: dynamoDB });

  const iam = R.mapObjIndexed(iamAwsPartial, iamWrap);
  const ecr = R.mapObjIndexed(ecrAwsPartial, ecrWrap);

  const STATE = {
    vpcId: null,
    zoneId: null,
    route: null,
    subnet: null,
    pullRequest: null,
    deployment: null,
    acl: null,
    ec2Mgr: null
  };


  function state() {
    if (!STATE.vpcId || !STATE.zoneId) {
      return initState();
    }
    return Q.resolve(STATE);
  }

  function ecrAwsPartial(fn) {
    return R.partial(fn, { ecr: util.makePromiseApi(awsEcr) });
  }
  function iamAwsPartial(fn) {
    return R.partial(fn, { iam: util.makePromiseApi(awsIam) });
  }

  /**
   * @param projectId
   * @returns {Q.Promise}
   */
  function destroy(projectId) {
    return state()
      .then((s) => ec2.describeProject(projectId)
        .then((list) => {
          if (list.length) {
            throw new Error('ProjectManager: Cannot destroy project while ' +
              'open pull requests exist');
          }
          return s
            .subnet.destroy(projectId)
            .then(() => s.acl.destroy(projectId));
        }));
  }

  /**
   * @param {string} projectId
   * @returns {Request|Promise.<T>}
   */
  function create(projectId) {
    return state()
      .then((s) => Q
        .all([
          s.route.findDefault()(),
          s.acl.create(projectId),
          ecr.create(projectId) ])
        .then((results) => {
          const routeId = results[0].RouteTableId;
          const aclId = results[1].NetworkAcl.NetworkAclId;
          const repoArn = results[2].repositoryArn;

          return Q
            .all([
              s.subnet.create(projectId, routeId, aclId),
              iam.createProjectUser(projectId, repoArn)])
            .then((r) => {
              return {
                credentials:  r[1],
                aws: {
                  vpcId: s.vpcId,
                  registryId: results[2].registryId,
                  region: DEFAULT_REGION
                }
              };
            });
        }));
  }

  /**
   * @param {string} projectId
   * @returns {Request}
   */
  function findOrCreateProject(projectId) {
    return state()
      .then((s) => s.subnet.findProject(projectId)
        .fail(() => create(projectId)
          .then((sDesc) => sDesc)));
  }

  /**
   * @param {string} projectId
   * @param {string} pr
   * @param {Object} appDef
   * @param {Object=} sshData
   * @returns {Q.Promise}
   */
  function createPR(projectId, pr, appDef, sshData) {
    return state()
      .then((s) => findOrCreateProject(projectId)
        .then(() => prExists(projectId, pr)
          .then((exists) => {
            if (!exists) {
              return s.pullRequest
                .create(projectId, pr, appDef, sshData);
            }
            return s.pullRequest
              .update(projectId, pr, appDef, sshData, 
                elbLib.helpers.elbPrId(projectId, pr), exists);
          })));
  }

  /**
   * @param {string} projectId
   * @param {string} pr
   * @returns {Q.Promise}
   */
  function destroyPR(projectId, pr) {
    return state()
      .then((s) => s
      .pullRequest.destroy(projectId, pr + ''));
  }

  /**
   * @returns {Q.Promise}
   */
  function destroyExpiredPRs() {
    const now = Date.now();

    const extractKeys = R.compose(
      R.map(R.reduce((m, p) => R.assoc(p.Key, p.Value, m), {})),
      R.unnest,
      R.map(R.compose(R.map(R.prop('Tags')),
                      R.prop('Instances'))));

    const extractDeadPRs = R.filter(R.allPass([
      R.compose(R.gt(now), R.prop(constants.EXPIRES_TAG)),
      R.prop(constants.PR_TAG)]));

    const mapDestroy = R.map(R
      .compose(R
        .apply(destroyPR), (v) => [
        v[constants.PROJECT_TAG],
        v[constants.PR_TAG]]));

    return state()
      .then((s) => s.ec2Mgr.describe()().then((d) => {
        const keys = extractKeys(d);
        const deadPRs = extractDeadPRs(keys);

        return Q.all(mapDestroy(deadPRs));
      }));
  }

  /**
   * @param {string} projectId
   * @param {string} dep
   * @param {Object} appDef
   * @param {Object=} sshData
   * @returns {Q.Promise}
   */
  function createDeployment(projectId, dep, appDef, sshData) {
    return state()
      .then((s) => findOrCreateProject(projectId)
        .then(() => deploymentExists(projectId, dep)
          .then((exists) => {
            if (!exists) {
              return s
                .deployment.create(projectId, dep, appDef, sshData );
            }
            return s.deployment.update(projectId, dep, appDef, sshData, 
              elbLib.helpers.elbDeploymentId(projectId, dep), exists);
          })));
  }

  /**
   * @param {string} projectId
   * @param {string} dep
   * @returns {Q.Promise}
   */
  function destroyDeployment(projectId, dep) {
    return state()
      .then((s) => findOrCreateProject(projectId)
        .then((snDesc) => {
          return s.deployment.destroy(projectId, dep);
        }));
  }

  /**
   * @param {string} projectId
   * @returns {Q.Promise}
   */
  function describeProject(projectId) {
    return cluster.describeProject(projectId);
  }


  /**
   * @param {string} projectId
   * @returns {Q.Promise}
   */
  function writeGitHubKey(projectId, token) {
    const item = {
      ProjectName: { S: projectId },
      GithubSecretToken: { S: token }
    };

    //return ddbManager
    //  .insertItem(ddbManager.tableNames.GITHUB_AUTH_TOKEN_TABLE, item);
    return Q.resolve();
  }

  function listProjects() {
    return state()
      .then((s) => s
        .subnet.describe()
        .then((dBlock) => dBlock
          .map((block) => block.Tags ))
        .then((tags) => {
            return R.flatten(tags.map((t) => {
              return t.map((v) => {
                if(v.Key === constants.PROJECT_TAG) {
                  return v.Value;
                }

                return null;
              }).filter(R.compose(R.not, R.isNil));
            }));
          }));
  }

  /**
   * @param {string} projectId
   * @param {string} pr
   * @returns {Promise<Array.<string>>}
   */
  function prExists(projectId, pr) {
    return state()
      .then((s) => s
        .ec2Mgr.listPr(projectId, pr)()
        .then((list) => list.length ? list : null));
  }

  /**
   * @param {string} projectId
   * @param {string} name
   * @returns {Promise<Array.<string>>}
   */
  function deploymentExists(projectId, name) {

    return state()
      .then((s) => s
        .ec2Mgr.listDeployment(projectId, name)()
        .then((list) => list.length ? list : null));
  }


  /**
   * @param {string} projectId
   * @param {string} deploymentName
   * @param {string} sha
   * @param {Object} appDef
   * @returns {Q.Promise}
   */
  function updateDeployment(projectId, deploymentName, sha, appDef) {
    // call deployment manager
    return state()
      .then((s) => findOrCreateProject(projectId)
        .then((snDesc) => s
          .deployment.update(projectId, deploymentName, sha, appDef)));
  }

  function mapEc2ProjectDetails(instance) {
    const result = {
      type: 'type',
      identifier: '?',
      str: '',
      ip: '',
      state: ''
    };
    let inst;
    let tags;

    if (!instance.Instances.length) {
      return result;
    }
    inst = instance.Instances[0];
    tags = inst.Tags;
    result.ip = inst.PublicIpAddress;
    result.state = inst.State.Name;

    tags.forEach((tag) => {
      if (tag.Key === constants.PR_TAG) {
        result.type = 'PR';
        result.identifier = tag.Value;
      }
      if (tag.Key === constants.DEPLOYMENT_TAG) {
        result.type = 'Deployment';
        result.identifier = tag.Value;
      }
    });

    result.str = `${result.type} ${result.identifier} ` +
      `(${result.ip}/${result.state})`;

    return result;
  }

  /**
   * @param {string} projectId
   * @returns {Q.Promise<string[]>}
   */
  function listSSHAbleInstances(projectId) {
    return state()
      .then((s) => s
        .ec2Mgr.describeProject(projectId)()
        /** @todo flatten this */
        .then((result) => result.Reservations
          .map(mapEc2ProjectDetails)));
  }

  function listDeployments(projectId) {
    return state()
      .then((s) => s
        .ec2Mgr.listProject(projectId)());
  }

  function initState() {
    return Q.all([
      vpc.findVpc()(),
      r53.findId()
    ]).then((results) => {
      const state = STATE;
      const AWS = {
         ec2: promisifiedEc2, vpcId: state.vpcId 
      };

      state.vpcId = results[0].VpcId;
      state.zoneId = results[1];
      state.route = Route.bindAws(AWS); 
      state.subnet = Subnet(ec2, state.vpcId);
      state.acl = Acl(ec2, state.vpcId);
      state.ec2Mgr = Ec2.bindAws(AWS);
      state.pullRequest = Pr(ec2, ecs, awsRoute53, elb, state.vpcId,
        state.zoneId);
      state.deployment = Deployment(ec2, ecs, awsRoute53, elb, state.vpcId,
        state.zoneId);

      return STATE;
    });
  }

  return {
    create,
    createDeployment,
    createPR,
    deploymentExists,
    describeProject,
    destroy,
    destroyDeployment,
    destroyExpiredPRs,
    destroyPR,
    hashTable: ht,
    iam,
    listDeployments,
    listProjects,
    listSSHAbleInstances,
    prExists,
    updateDeployment,
    writeGitHubKey
  };
}

module.exports = getProjectManager;
