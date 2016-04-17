'use strict';
/**
 * Interface to AWS ELB wrappers (Elastic Load Balancing)
 *
 * @module aws/elb
 */

const util = require('../../util');
const constants = require('../../constants');
const awsCommon = require('../common');
const awsConstants = require('../aws-constants');
const tag = require('./elb-tag.js');
const pListeners = require('./port-listener');
const TCP = 'TCP';
const SSL = 'SSL';
const RX_ALPHA_NUM = /[^a-z0-9]/gi;

module.exports = {
  bindAws,
  create,
  createDeployment,
  createPr,
  destroy,
  destroyDeployment,
  destroyPr,
  describeDeployment,
  describePr,
  describeAll,
  configureHealthCheck,
  deRegisterInstances,
  registerInstances,
  helpers: {
    defaultListeners,
    describeById,
    elbDeploymentId,
    elbPrId,
    mapInstances
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
 * @param {string} loadBalancerId
 * @param {number=} healthyThresh
 * @param {number=} unhealthyThresh
 * @param {string=} target
 * @param {number=} timeout
 * @param {number=} interval
 * @returns {function(): Promise}
 */
function configureHealthCheck(aws, loadBalancerId, healthyThresh,
                              unhealthyThresh, target, timeout, interval) {
  /** @todo constant these defaults */
  target = target || 'HTTP:80/favicon.ico';
  interval = interval || 60;
  timeout = timeout || interval - 10;
  unhealthyThresh = unhealthyThresh || 5;
  healthyThresh = healthyThresh || 2;

  /**
   * @returns {Promise}
   */
  function promiseToConfigureHealthCheck() {
    return aws.elb.configureHealthCheck({
      LoadBalancerName: loadBalancerId,
      HealthCheck: {
        HealthyThreshold: healthyThresh,
        Interval: interval,
        Target: target,
        Timeout: timeout,
        UnhealthyThreshold: unhealthyThresh
      }
    });
  }
  
  return promiseToConfigureHealthCheck;
}

/**
 * ELB ids have to be < 32 characters, so our resourceIds are no good
 * @param {string} projectId
 * @param {string} deployment
 * @returns {string}
 */
function elbDeploymentId(projectId, deployment) {
  projectId = projectId.replace(RX_ALPHA_NUM, '');
  deployment = deployment.replace(RX_ALPHA_NUM, '');
  const id = `${projectId}-${deployment}`;
  if (id.length > 31) {
    return id.slice(0, 31);
  }
  return id;
}

/**
 * ELB ids have to be < 32 characters, so our resourceIds are no good
 * @param {string} projectId
 * @param {string} pr
 * @returns {string}
 */
function elbPrId(projectId, pr) {
  projectId = projectId.replace(RX_ALPHA_NUM, '');
  pr = pr.replace(RX_ALPHA_NUM, '');
  const id = `${projectId}-pr-${pr}`;
  if (id.length > 31) {
    return id.slice(0, 31);
  }
  return id;
}

/**
 * @param {string} certId
 * @param {boolean=} useInternalSSL
 * @returns {Array}
 */
function defaultListeners(certId, useInternalSSL) {
  return [
    pListeners.create(80, 80, TCP, TCP),
    useInternalSSL ? pListeners.create(443, 443, TCP, SSL, certId) :
      pListeners.create(80, 443, TCP, SSL, certId)
  ];
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} deployment
 * @param {string} subnet
 * @param {string} securityGroup
 * @param {string} certId
 * @param {boolean=} useInternalSSL defaults to false
 * @returns {function(): Promise.<{ dns: string, id: string}>}
 */
function createDeployment(aws, projectId, deployment, subnet, securityGroup,
                          certId, useInternalSSL) {
  if (!projectId || !deployment) {
    throw new TypeError('createDeployment requires a projectId and ' +
      'deployment name');
  }
  useInternalSSL = useInternalSSL ? true : false;
  const listeners = defaultListeners(certId, useInternalSSL);
  const tags = [
    tag.create(constants.PROJECT_TAG, projectId),
    tag.create(constants.DEPLOYMENT_TAG, deployment)
  ];
  const id = elbDeploymentId(projectId, deployment);
  const createFn = create(aws, listeners, [subnet], [securityGroup], id, tags);
  const safeCreate = util.makeRetryPromiseFunction(
    createFn,
    awsConstants.AWS_RETRY_LIMIT,
    awsConstants.AWS_RETRY_DELAY,
    awsConstants.AWS_RETRY_MULTIPLIER,
    null,
    'elb: create-deployment'
  );
  
  function promiseToCreateDeployment() {
    return describeById(aws, id)()
      .fail(() => safeCreate());
  }
  return promiseToCreateDeployment;
}


/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} pr
 * @param {string} subnet
 * @param {string} securityGroup
 * @param {string} certId
 * @param {boolean=} useInternalSSL defaults to false
 * @returns {function(): Promise.<{ dns: string, id: string}>}
 */
function createPr(aws, projectId, pr, subnet, securityGroup, certId,
                  useInternalSSL) {
  if (!projectId || !pr) {
    throw new TypeError('createPr requires a projectId and pr number');
  }
  useInternalSSL = useInternalSSL ? true : false;
  const listeners = defaultListeners(certId, useInternalSSL);
  const tags = [
    tag.create(constants.PROJECT_TAG, projectId),
    tag.create(constants.PR_TAG, pr)
  ];
  const id = elbPrId(projectId, pr);
  const createFn = create(aws, listeners, [subnet], [securityGroup], id, tags);
  const safeCreate = util.makeRetryPromiseFunction(
    createFn,
    awsConstants.AWS_RETRY_LIMIT,
    awsConstants.AWS_RETRY_DELAY,
    awsConstants.AWS_RETRY_MULTIPLIER,
    null,
    'elb: create-pr'
  );
  
  function promiseToCreatePr() {
    return describeById(aws, id)()
      .fail(() => safeCreate());
  }
  return promiseToCreatePr;
}

/**
 * @param {AwsWrapper} aws
 * @param {Array.<ElbPortListener>=} listeners
 * @param {string[]} subnets
 * @param {string[]} securityGroups
 * @param {string} loadBalancerId
 * @param {Array.<ElbTag>=}tags
 * @returns {function(): Promise.<{ dns: string, id: string}>}
 */
function create(aws, listeners, subnets, securityGroups, loadBalancerId, tags) {
  tags = Array.isArray(tags) ? tags : [];

  /**
   * @return {Promise.<{ dns: string, id: string}>}
   */
  function promiseToCreate() {
    return aws.elb.createLoadBalancer({
        Listeners: listeners,
        LoadBalancerName: loadBalancerId,
        SecurityGroups: securityGroups,
        Subnets: subnets,
        Tags: [tag.create(constants.CLUSTERNATOR_TAG, true)].concat(tags) })
      .then((results) => {
        return {
          dns: results.DNSName,
          id: loadBalancerId
        };
      });
  }
  return promiseToCreate;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} pr
 * @returns {function(): Promise}
 * @throws {TypeError}
 */
function destroyPr(aws, projectId, pr) {
  if (!projectId || !pr) {
    throw new TypeError('destroyPr requires a projectId and pr number');
  }
  const id = elbPrId(projectId, pr);

  return destroy(aws, id);
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} deployment
 * @returns {function(): Promise}
 * @throws {TypeError}
 */
function destroyDeployment(aws, projectId, deployment) {
  if (!projectId || !deployment) {
    throw new TypeError('destroyDeployment requires a projectId and pr number');
  }
  const id = elbDeploymentId(projectId, deployment);
  return destroy(aws, id);
}

/**
 * @param {AwsWrapper} aws
 * @param {string} loadBalancerId
 * @return {function(): Promise}
 * @throws {TypeError}
 */
function destroy(aws, loadBalancerId) {
  if (!loadBalancerId) {
    throw new TypeError('destroyLoadBalancer requires a loadBalancerId');
  }

  /**
   * @returns {Promise}
   */
  function promiseToDestroy() {
    return aws.elb.deleteLoadBalancer({
      LoadBalancerName: loadBalancerId
    });
  }
  return promiseToDestroy;
}

/**
 * @param {AwsWrapper} aws
 * @returns {function(): Promise}
 */
function describeAll(aws) {
  /**
   * @return {Promise}
   */
  function promiseToDescribeAll() {
    return aws.elb.describeLoadBalancers();
  }
  return promiseToDescribeAll;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} id
 * @returns {function(): Promise.<{ dns: string, id: string }>}
 */
function describeById(aws, id) {
  /**
   * @returns {Promise.<{ dns: string }>}
   */
  function promiseToDescribeById(){
    return aws.elb
      .describeLoadBalancers({
        LoadBalancerNames: [
          id
        ]})
      .then((results) => {
        if (!results.LoadBalancerDescriptions.length) {
          throw new Error(`describeDeployment: no deployment found: ${id}`);
        }
        return {
          dns: results.LoadBalancerDescriptions[0].DNSName,
          id
        };
      });
  }
  return promiseToDescribeById;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} deployment
 * @return {function(): Promise.<{ dns: string }>}
 * @throws {TypeError}
 */
function describeDeployment(aws, projectId, deployment) {
  if (!projectId || !deployment) {
    throw new TypeError('describeDeployment requires a projectId and ' +
      'deployment name');
  }
  const id = elbDeploymentId(projectId, deployment);
  return describeById(aws, id);
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} pr
 * @return {function(): Promise.<{ dns: string, id: string }>}
 * @throws {TypeError}
 */
function describePr(aws, projectId, pr) {
  if (!projectId || !pr) {
    throw new TypeError('describePr requires a projectId and pr number');
  }
  const id = elbPrId(projectId, pr);
  return describeById(aws, id);
}

/**
 * @param {string|Array.<string>} instances
 * @returns {Array.<{ InstanceId: string }>}
 * @throws {TypeError}
 */
function mapInstances(instances) {
  if (instances && typeof instances === 'string') {
    instances = [instances];
  }
  if (!Array.isArray(instances)) {
    throw new TypeError('registerInstances expects instances to be an array ' +
      'of strings, given ' + typeof instances, '.');
  }
  return instances.map((id) => {
    return {
      InstanceId: id
    };
  });
}

/**
 * @param {AwsWrapper} aws
 * @param {string} loadBalancerId
 * @param {string[]} instances
 * @returns {function(): Promise}
 * @throws {TypeError}
 */
function registerInstances(aws, loadBalancerId, instances) {
  if (!loadBalancerId) {
    throw new TypeError('registerInstances requires a loadBalancerId');
  }
  
  const mappedInstances = mapInstances(instances);
  
  function promiseToRegister() {
    return aws.elb.registerInstancesWithLoadBalancer({
      Instances: mappedInstances,
      LoadBalancerName: loadBalancerId
    });
  }
  return promiseToRegister;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} loadBalancerId
 * @param {string[]} instances
 * @returns {function(): Promise}
 * @throws {TypeError}
 */
function deRegisterInstances(aws, loadBalancerId, instances) {
  if (!loadBalancerId) {
    throw new TypeError('deRegisterInstances requires a loadBalancerId');
  }
  
  const mappedInstances = mapInstances(instances);
  
  function promiseToDeRegister() {
    return aws.elb.deregisterInstancesFromLoadBalancer({
      Instances: mappedInstances,
      LoadBalancerName: loadBalancerId
    });
  }
  return promiseToDeRegister;
}
