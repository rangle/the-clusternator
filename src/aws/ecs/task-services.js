'use strict';
/**
 * Simplifies dealing with AWS's ECS task services
 *
 * @module aws/ecs/task-services
 */

const SERVICE_POLL_DELAY = 15 * 1000;

const Q = require('q');
const R = require('ramda');
const util = require('../../util');
const awsUtil = require('../aws-util');

const taskDefinitions = require('./task-definitions');

/**
 * In repl, the helper methods won't be bound properly
 * unsure how to handle createTasksAndServices wrt "findAndCreate"
 */

module.exports = {
  bindAws,
  create: findOrCreate,
  createTaskAndService, // NOTE: No find method used
  createTasksAndServices, // NOTE: No find method used
  describe,
  describeMany,
  destroy: findAndDestroy,
  list,
  stop,
  stopAndDestroy, // NOTE: No find method used
  stopAndDestroyCluster, // NOTE: No find method used
  update,
  helpers: {
    checkForInactive,
    create,
    destroy,
    getStatus,
    processDescription, // NOTE: Moved from clusterManager
    processDescriptions, // NOTE: Moved from clusterManager
    waitForDrained, // NOTE: not tested
    waitForReady, // NOTE: not tested
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
 * Creates a service
 * @param {AwsWrapper} aws
 * @param {string} cluster Name or ARN
 * @param {string} serviceName
 * @param {Object} taskDefinition 
 * @returns {function(): Promise.<Object>} service
 */
function create(aws, cluster, serviceName, taskDefinition) {
  if(!cluster) {
    throw new TypeError('create requires a cluster name or ARN');
  }
  if(!serviceName) {
    throw new TypeError('create requires a serviceName');
  }
  if(!taskDefinition) {
    throw new TypeError('create requires task definition'
      + ' family:revision or ARN');
  }

  function promiseToCreate() {
    return aws.ecs
      .createService({
        cluster,
        desiredCount: 1, //TODO you should be able to change this
        serviceName,
        taskDefinition,
      })
      .then(R.prop('service'));
  }

  return promiseToCreate;
}

/**
 * Finds or creates a service
 *
 * @param {AwsWrapper} aws
 * @param {string} cluster Name or ARN
 * @param {string} serviceName
 * @param {string} taskDefinitionArn
 * @returns {function(): Promise.<Object>} service
 */
function findOrCreate(aws, cluster, serviceName, taskDefinitionArn) {
  
  function promiseToFindOrCreate() {
    return describeMany(aws, cluster, [serviceName])()
      .then((services) =>
        R.find(R.propEq('taskDefinition', taskDefinitionArn), services)
          || create(aws, cluster, serviceName, taskDefinitionArn)()
      );
  }

  return promiseToFindOrCreate;
}

function checkForInactive(services) {
  if (!services || !services.length) {
    return false;
  }

  return services[0].status === 'INACTIVE';
}

// TODO refactor this to be elsewhere
/**
 * This is the cool part.
 * cluster isn't actually an ARN?
 *
 * @param {AwsWrapper} aws
 * @param {string} cluster Name or ARN
 * @param {string} serviceName
 * @param {Object} task
 * @returns {function(): Promise.<Object>} service
 */
function createTaskAndService(aws, cluster, serviceName, task) {
  if(!cluster) {
    throw new TypeError('createTaskAndService requires a cluster name or ARN');
  }
  if(!serviceName) {
    throw new TypeError('createTaskAndService requires a serviceName');
  }
  if(!task) {
    throw new TypeError('createTaskAndService requires a task object');
  }

  function waitForReady_(service) {
    return waitForReady(aws, service.cluster, service.serviceArn)();
  }

  function promiseToCreateTaskAndService() {
    taskDefinitions.create(aws, task)()
      .then((taskDef) => {
        util.info('Created task', taskDef.taskDefinitionArn);
        return create(aws, cluster, serviceName, taskDef.taskDefinitionArn)();
      })
      .then(waitForReady_)
      .fail(Q.reject);
  }

  return promiseToCreateTaskAndService;
}

// Renamed from`createTasksAndServicesOnCluster`
// Formerly exported as `create`

/**
 * @param {AwsWrapper} aws
 * @param {string} cluster Name or ARN
 * @param {string} serviceName
 * @param {Object} appDef
 * @returns {function(): Promise.<Object[]>} service
 */
function createTasksAndServices(aws, cluster, serviceName, appDef) {
  if(!cluster) {
    throw new TypeError('createTasksAndServices requires '
      + 'a cluster name or ARN');
  }
  if(!serviceName) {
    throw new TypeError('createTasksAndServices requires a serviceName');
  }
  if(!appDef || !appDef.tasks) {
    throw new TypeError('createTasksAndServices requires a appDef object');
  }

  function promiseToCreateTasksAndServices() {
    function createTaskAndService_(task) {
      return createTaskAndService(aws, cluster, serviceName, task)();
    }

    const taskDefPromises = R.map(createTaskAndService_, appDef.tasks);

    return Q.all(taskDefPromises);
  }

  return promiseToCreateTasksAndServices;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} cluster Name or ARN
 * @returns {function(): Promise.<Object[]>} services
 */
function describe(aws, cluster) {
  if(!cluster) {
    throw new TypeError('describe requires a cluster name or ARN');
  }

  function promiseToDescribe() {
    return list(aws, cluster)()
      .then((serviceArns) => describeMany(aws, cluster, serviceArns)());
  }

  return promiseToDescribe;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} cluster Name or ARN
 * @param {string[]} services Names or ARNs
 * @returns {function(): Promise.<Object[]>} services
 */
function describeMany(aws, cluster, services) {
  if(!cluster) {
    throw new TypeError('describeMany requires a cluster name or ARN');
  }
  if(!services || !services.length) {
    throw new TypeError('describeMany requires array of service name or ARN');
  }

  function promiseToDescribeMany() {
    return aws.ecs
      .describeServices({
        cluster,
        services: [].concat(services)
      })
      .then(R.prop('services'))
      .then(processDescriptions);
  }

  return promiseToDescribeMany;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} cluster Name or ARN
 * @param {string} service Name or ARN
 * @returns {function(): Promise.<string>}
 */
function destroy(aws, cluster, service) {
  if (!cluster) {
    throw new TypeError('destroy requires cluster name or ARN');
  }
  if (!service) {
    throw new TypeError('destroy requires service name or ARN');
  }

  function promiseToDestroy() {
    const params = {
      cluster,
      service
    };

    return aws.ecs.deleteService(params)
      .then(() => 'deleted');
  }

  return promiseToDestroy;
}

/**
 * Finds then destroys a service
 *
 * @param {AwsWrapper} aws
 * @param {string} cluster Name or ARN
 * @param {string} service Name or ARN
 * @returns {function(): Promise.<Object>} service
 */
function findAndDestroy(aws, cluster, service) {
  
  function promiseToFindAndDestroy() {
    return describeMany(aws, cluster, [service])()
      .then((services) =>
        services && services.length
          ? destroy(aws, cluster, service)()
          : 'already deleted'
      );
  }

  return promiseToFindAndDestroy;
}

/**
 * Checks first service for steady state
 * @param {string[]} services
 * @return {number} -1 = no services; 0 = steady state; >0 = not steady state
 */
function getStatus(services) {
  if (!services || !services.length) {
    return -1;
  }

  const isSteady = services[0].events.every((event) => {
    util.debug(`Polling service for ready check: ${event.message}`);
    return event.message.indexOf('steady state') === -1;
  });

  return Number(isSteady);
}

/**
 * @param {AwsWrapper} aws
 * @param {string} cluster Name or ARN
 * @returns {function(): Promise.<string[]>}
 */
function list(aws, cluster) {
  if (!cluster) {
    throw new TypeError('list requires cluster ARN');
  }

  function promiseTolist() {
    return aws.ecs
      .listServices({
        cluster: cluster
      })
      .then(R.prop('serviceArns'));
  }

  return promiseTolist;
}

/**
 * @param {AWSServiceDescription} service
 * @returns {ClusternatorServiceDescription}
 */
function processDescription(service) {
  if (!service) {
    return null;
  }

  const lastEvent = R.path(['events', 0, 'message'], service);
  const picked = R.pick([
    'serviceArn',
    'taskDefinition',
    'cluster',
    'desiredCount',
    'pendingCount',
    'status',
    'deployments',
  ], service);

  if (typeof lastEvent !== 'undefined') {
    picked.lastEvent = lastEvent;
  }

  return picked;
}

/**
 * @param {AWSServiceDescription[]} descriptions
 * @returns {ClusternatorServiceDescription[]}
 */
function processDescriptions(services) {
  const processed = services
    .map(processDescription)
    .filter(R.complement(R.isEmpty));

  return processed;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} cluster Name or ARN
 * @param {string} service Name or ARN
 * @returns {function(): Promise.<Object>} service
 */
function stop(aws, cluster, service) {
  if(!cluster) {
    throw new TypeError('stop requires a cluster name or ARN');
  }
  if(!service) {
    throw new TypeError('stop requires a service name or ARN');
  }

  function promiseToStop() {
    return update(aws, cluster, service, {
      desiredCount: 0
    })();
  }
  
  return promiseToStop;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} cluster Name or ARN
 * @param {string[]} service Name or ARN
 * @returns {function(): Promise.<string>}
 */
function stopAndDestroy(aws, cluster, service) {
  if(!cluster) {
    throw new TypeError('stopAndDestroy requires a cluster name or ARN');
  }
  if(!service) {
    throw new TypeError('stopAndDestroy requires a service name or ARN');
  }

  function promiseToStopAndDestroy() {
    return stop(aws, cluster, service)
      // no need for findAndDestroy since this comes from a list already
      .then((service) => destroy(aws, cluster, service.service));
  }

  return promiseToStopAndDestroy;
}

/**
 * Stops and destroys all services on cluster
 *
 * @param {AwsWrapper} aws
 * @param {string} cluster Name or ARN
 * @returns {function(): Promise.<Object>} service
 */
function stopAndDestroyCluster(aws, cluster) {
  if(!cluster) {
    throw new TypeError('stopAndDestroyCluster requires a cluster name or ARN');
  }

  function promiseToStopAndDestroyCluster() {
    return list(aws, cluster)()
      .then((serviceArns) => {
        const stopAndDestroyPromises = serviceArns.map(
          (serviceArn) => stopAndDestroy(aws, cluster, serviceArn)()
        );

        return Q.all(stopAndDestroyPromises)
          .then(() => waitForDrained(aws, cluster, serviceArns)());
      })
      .fail(Q.reject);
  }

  return promiseToStopAndDestroyCluster;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} cluster Name or ARN
 * @param {string} service Name or ARN
 * @param {Object} updateObj
 * @returns {function(): Promise.<Object>} service
 */
function update(aws, cluster, service, updateObj) {
  if (!cluster) {
    throw new TypeError('update requires cluster name or ARN');
  }
  if (!service) {
    throw new TypeError('update requires service name or ARN');
  }
  if (!updateObj) {
    throw new TypeError('update requires update object');
  }

  function promiseToUpdate() {
    let params = {
      cluster,
      service,
    };

    params = R.merge(params, updateObj);

    return aws.ecs.updateService(params)
      .then(R.prop('service'));
  }

  return promiseToUpdate;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} cluster Name or ARN
 * @param {string[]} services Names or ARNs
 * @returns {Promise.<Object[]>} services
 */
function waitForDrained(aws, cluster, services) {
  if (!cluster) {
    throw new TypeError('waitForDrained requires cluster name or ARN');
  }
  if (!services) {
    throw new TypeError('waitForDrained requires array of service name or ARN');
  }

  function promiseToWaitForDrained() {
    const d = Q.defer();

    describeMany(aws, cluster, services)()
      .then((services) => {

        const isInactive = checkForInactive(services);
        if (isInactive) {
          util.info('Service has drained');
          d.resolve();
        } else {
          util.info('Service is draining');

          setTimeout(() => {
            waitForDrained(cluster, services)()
              .then(d.resolve, d.reject);
          }, SERVICE_POLL_DELAY);
        }

      })
      .fail(d.reject);

    return d.promise;
  }

  return promiseToWaitForDrained;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} cluster name or ARN
 * @param {string[]} services Names or ARNs
 * @returns {function(): Promise.<Object[]>} services
 */
// alternative name: waitForReady
function waitForReady(aws, cluster, services) {
  if (!cluster) {
    throw new TypeError('waitForDrained requires cluster name or ARN');
  }
  if (!services) {
    throw new TypeError('waitForDrained requires array of service name or ARN');
  }

  function promiseToWaitForReady() {
    const d = Q.defer();

    describeMany(aws, cluster, services)()
      .then((services) => {

        const status = getStatus(services);
        if (status < 0) {
          d.reject(new Error('Error polling new service: ' +
            `cluster: ${cluster}, service: ${services}`));
        } else if (status === 0) {
          util.info('Service has reached a steady state');
          d.resolve(services);
        } else {
          setTimeout(() => {
            waitForReady(aws, cluster, services)()
              .then(d.resolve, d.reject);
          }, SERVICE_POLL_DELAY);
        }

      })
      .fail(d.reject);

    return d.promise;
  }

  return promiseToWaitForReady;
}
