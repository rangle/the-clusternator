'use strict';
/**
 * @module aws/ec2/vm
 * Basic Amazon AWS EC2 wrapper
 */

const R = require('ramda');

const constants = require('../../../constants');
const awsConstants = require('../../aws-constants');
const networkInterface = require('./../network-interface');
const vmParams = require('./vm-params');
const filter = require('./../ec2-filter');
const util = require('../../../util');
const awsCommon = require('../../common');

module.exports = {
  bindAws,
  checkInstanceStatuses,
  create,
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
  makeReadyPredicate,
  makeTerminatedPredicate,
  waitForReady,
  waitForTermination,
  helpers: {
    areInstancesAtState,
    checkForState,
    flattenDescriptions,
    flattenInstanceStatuses
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
 * @returns {Array.<Filter>}
 */
function baseFilters(aws) {
  return [
        filter.createVpc(aws.vpcId),
        filter.createClusternator()
      ];
}

/**
 * @param {AwsWrapper} aws
 * @returns 
 {function(): Promise.<{ Reservations: Array.<{ Instances: Array }> }>}
 */
function describe(aws) {

  /**
   * @returns {Promise}
   */
  function promiseToDescribe() {
    return aws.ec2.describeInstances({
      Filters: baseFilters(aws)
    });
  }

  return promiseToDescribe;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} deployment
 * @return {function(): Promise.<{ Reservations: Array.<{ Instances: Array> }>}
 * @throws {TypeError}
 */
function describeDeployment(aws, projectId, deployment) {
  if (!projectId || !deployment) {
    throw new TypeError('describeDeployment requires a projectId and a ' +
      'deployment name');
  }
  /**
   * @returns {Promise}
   */
  function promiseToDescribeDeployments() {
    return aws.ec2.describeInstances({
      Filters: baseFilters(aws)
        .concat([
          filter.createTag(constants.DEPLOYMENT_TAG, deployment),
          filter.createTag(constants.PROJECT_TAG, projectId)
        ])
    });
  }

  return promiseToDescribeDeployments;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} pr
 * @return {function(): Promise.<{ Reservations: Array.<{ Instances: Array> }>}
 * @throws {TypeError}
 */
function describePr(aws, projectId, pr) {
  if (!projectId || !pr) {
    throw new TypeError('describePr requires a projectId and a pr number');
  }
  /**
   * @returns {Promise}
   */
  function promiseToDescribeDeployments() {
    return aws.ec2.describeInstances({
      Filters: baseFilters(aws)
        .concat([
          filter.createTag(constants.PR_TAG, pr + ''),
          filter.createTag(constants.PROJECT_TAG, projectId)
        ])
    });
  }

  return promiseToDescribeDeployments;
}

/**
 * @param {AwsWrapper} aws
 * @return {function(): Promise.<{ Reservations: Array.<{ Instances: Array> }>}
 * @throws {TypeError}
 */
function describeProject(aws, projectId) {
  if (!projectId) {
    throw new TypeError('describeProject requires a projectId');
  }
  /**
   * @returns {Promise}
   */
  function promiseToDescribeDeployments() {
    return aws.ec2.describeInstances({
      Filters: baseFilters(aws)
        .concat([
          filter.createTag(constants.PROJECT_TAG, projectId)
        ])
    });
  }

  return promiseToDescribeDeployments;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} sgId
 * @param {string} subnetId
 * @param {string=} userData _base64_ string of user data to run on init
 * @returns {function(): Promise}
 */
function create(aws, sgId, subnetId, userData) {
  
  /**
   * @returns {Promise}
   */
  function promiseToCreate() {
    const nic = networkInterface.create(sgId, subnetId);
    const params = vmParams.create(nic);
    if (userData) {
      params.UserData = userData;
    }
    return aws.ec2.runInstances(params)
      .then((results) => waitForReady(aws, results.Instances
        .map(mapInstanceId))()
        .then(() => results.Instances.map(mapInstanceId)));
  }
  return promiseToCreate;
}


/**
 * @param {AwsWrapper} aws
 * @param {string|string[]} instanceId
 * @returns {function(): Promise}
 * @throws {TypeError}
 */
function destroy(aws, instanceId) {
  if (!instanceId) {
    throw new TypeError('ec2 destroy requires instanceId(s)');
  }
  if (!Array.isArray(instanceId)) {
    instanceId = [instanceId];
  }
  /**
   * @returns {Promise}
   */
  function promiseToDestroy() {
    util.info('ec2: destroying', instanceId);
    return aws.ec2.stopInstances({ InstanceIds: instanceId })
      .then(() =>  aws.ec2.terminateInstances({ InstanceIds: instanceId })
        .then(() => waitForTermination(aws, instanceId)()));
  }
  return promiseToDestroy;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} deployment
 * @returns {function(): Promise}
 */
function destroyDeployment(aws, projectId, deployment) {

  function promiseToDestroyDeployment() {
    return listDeployment(aws, projectId, deployment)()
      .then((instances) => destroy(aws, instances)()); 
  }
  return promiseToDestroyDeployment;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} pr
 * @returns {function(): Promise}
 */
function destroyPr(aws, projectId, pr) {

  function promiseToDestroyPr() {
    return listPr(aws, projectId, pr)()
      .then((instances) => destroy(aws, instances)()); 
  }
  return promiseToDestroyPr;
}

/**
 * @param {{ InstanceId: string }} instance
 * @returns {string}
 */
function mapInstanceId(instance) {
  return instance.InstanceId; 
}


/**
 * @param {Array.<string>} descriptions
 */
function flattenDescriptions(descriptions) {
  return R.flatten(descriptions.Reservations.map((res) => {
    return res.Instances.map(mapInstanceId);
  }));
}

/**
 * @param {AwsWrapper} aws
 * @returns {function(): Promise.<Array.<string>>}
 */
function list(aws) {
  /**
   * @returns {Promise.<Array.<string>>}
   */
  function promiseToList() {
    return describe(aws)()
      .then(flattenDescriptions); 
  }
  return promiseToList;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} deployment
 * @returns {function(): Promise.<Array.<string>>}
 */
function listDeployment(aws, projectId, deployment) {
  /**
   * @returns {Promise.<Array.<string>>}
   */
  function promiseToListDeployment() {
    return describeDeployment(aws, projectId, deployment)()
      .then(flattenDescriptions);
  }  
  return promiseToListDeployment;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @param {string} pr
 * @returns {function(): Promise.<Array.<string>>}
 */
function listPr(aws, projectId, pr) {
  function promiseToListPr() {
    return describePr(aws, projectId, pr)()
      .then(flattenDescriptions);
  }
  return promiseToListPr;
  
}

/**
 * @param {AwsWrapper} aws
 * @param {string} projectId
 * @returns {function(): Promise.<Array.<string>>}
 */
function listProject(aws, projectId) {
  function promiseToListProject() {
    return describeProject(aws, projectId)()
      .then(flattenDescriptions);
  }
  return promiseToListProject;

}

/**
 * @param {{ instanceIds: Array.<string>, State: string, Tags: Array }} 
 reservation
 * @returns {{InstanceId: (string[]|Array.<string>), State: *, Tags: *}}
 */
function mapInstanceStatus(reservation) {
  return {
    InstanceId: reservation.InstanceId,
    State: reservation.State,
    Tags: reservation.Tags
  };
}

/**
 * @param {{ Reservations: Array }} resultObject
 * @returns {Array.<{ Tags: Array, InstanceId: string, State: Object }>}
 */
function flattenInstanceStatuses(resultObject) {
  if (!resultObject ||
    !resultObject.Reservations ||
    !resultObject.Reservations.length) {
    return [];
  }

  return resultObject.Reservations
    .reduce((state, el) => state.concat(el.Instances), [])
    .map(mapInstanceStatus);
}

/**
 * @param {AwsWrapper} aws
 * @param {string[]|string} instanceIds
 * @return {function(): Promise.
 <Array.<{ Tags: Array, State: Object, InstanceId: string }>>}
 * @throws {TypeError}
 */
function checkInstanceStatuses(aws, instanceIds) {
  if (!Array.isArray(instanceIds) && instanceIds) {
    instanceIds = [instanceIds];
  }
  
  if (!instanceIds || !instanceIds.length) {
    throw new TypeError('checkInstanceStatus: No instance IDs');
  }

  function promiseToCheckStatuses() {
    return aws.ec2.describeInstances({ InstanceIds: instanceIds })
      .then(flattenInstanceStatuses);
  }
  
  return promiseToCheckStatuses;
}

/**
 * @param {string} stateToCheck
 * @returns {function(boolean, { State: { Name: string } })}
 */
function checkForState(stateToCheck) {
  return (state, el) => {
    if (!state) {
      return state;
    }
    if (el.State.Name === stateToCheck) {
      return true;
    }
    return false;
  };
}

/**
 * @param {Array.<{ State: { Name: string } }>} instances
 * @param {string} state
 * @returns {boolean}
 * @throws {Error}
 */
function areInstancesAtState(instances, state) {
  if (!instances.length) {
    throw new Error('Ec2 No Instances Awaiting Readiness');
  }
  const allRunning = instances.reduce(checkForState(state), true);

  if (allRunning) {
    util.info(`Ec2s Are ${state}`);
    return true;
  } else {
    throw new Error(`Ec2s: Wait For ${state}`);
  }
}

/**
 * @param {AwsWrapper} aws
 * @param {string|string[]} instanceId
 * @returns {function(): Promise}
 */
function makeReadyPredicate(aws, instanceId) {
  /**
   * @returns {Promise}
   */
  function readyPredicate() {
    return checkInstanceStatuses(aws, instanceId)()
      .then((instances) => areInstancesAtState(instances, 'running'));
  }
  return readyPredicate;
}

/**
 * @param {AwsWrapper} aws
 * @param {string|string[]} instanceId
 * @returns {function(): Promise}
 */
function makeTerminatedPredicate(aws, instanceId) {
  /**
   * @returns {Promise.<boolean>}
   */
  function terminatePredicate() {
    return checkInstanceStatuses(aws, instanceId)()
      .then((instances) => areInstancesAtState(instances, 'terminated'));
  }
  return terminatePredicate;
}

/**
 * @param {AwsWrapper} aws
 * @param {string|string[]} instanceId
 * @returns {function(): Promise}
 */
function waitForReady(aws, instanceId) {
  const fn = makeReadyPredicate(aws, instanceId);

  /**
   * @returns {Promise}
   */
  function promiseToWaitForReady() {
    return util.waitFor(fn, awsConstants.AWS_EC2_POLL_INTERVAL,
      awsConstants.AWS_EC2_POLL_MAX);
  }
  
  return promiseToWaitForReady;
}


/**
 * @param {AwsWrapper} aws
 * @param {string|string[]} instanceId
 * @returns {function(): Promise}
 */
function waitForTermination(aws, instanceId) {
  const fn = makeTerminatedPredicate(aws, instanceId);

  /**
   * @returns {Promise}
   */
  function promiseToWaitForTerminated() {
    return util.waitFor(fn, awsConstants.AWS_EC2_POLL_INTERVAL,
      awsConstants.AWS_EC2_POLL_MAX);
  }
  return promiseToWaitForTerminated;
}
