'use strict';

const R = require('ramda');
const constants = require('../../constants');

module.exports = {
  create,
  destroy,
  describe,
  describeAll,
  helpers: {
    filterClusternatorTags
  }
};

function applySecurityGroupsToLoadBalancer() {

}

function attachLoadBalancerToSubnets() {

}

function configureHealthCheck() {

}

/**
 * @param {AwsWrapper} aws
 * @param {ElbPortListener[]=} listeners
 * @param {string[]} subnets
 * @param {string[]} securityGroups
 * @param {string[]} availabilityZones
 * @param {string} loadBalancerId
 * @param {ElbTag[]=}tags
 * @returns {Q.Promise}
 */
function create(aws, listeners, subnets, securityGroups,
                            availabilityZones, loadBalancerId, tags) {
  tags = Array.isArray(tags) ? tags : [];
  return aws.elb.createLoadBalancer({
    Listeners: listeners,
    LoadBalancerName: loadBalancerId,
    AvailabilityZones: availabilityZones,
    SecurityGroups: securityGroups,
    Subnets: subnets,
    Tags: [createTag(constants.CLUSTERNATOR_TAG, true)].concat(tags)
  });
}



/**
 * @param {AwsWrapper} aws
 * @param {string} loadBalancerId
 * @return {Q.Promise}
 */
function destroy(aws, loadBalancerId) {
  if (!loadBalancerId) {
    throw new TypeError('destroyLoadBalancer requires a loadBalacnerId');
  }
  return aws.elb.deleteLoadBalancer({
    LoadBalancerName: loadBalancerId
  });
}

function deleteLoadBalancer() {

}

function deregisterInstancesFromLoadBalancer() {

}

function filterClusternatorTags(loadBalancerDescriptions, tagDescs) {
  const tagIds = tagDescs.map((tagDesc) => tagDesc.LoadBalancerName);
  const tags = tagDescs.map((tagDesc) => tagDesc.Tags);
  return loadBalancerDescriptions
    .filter((desc) => {
      const tagIndex = tagIds.indexOf(desc.LoadBalancerName);
      if (tagIndex === -1) {
        return false;
      }
      return tags.find((el) => el
        .Name
        .indexOf(constants.CLUSTERNATOR_TAG) === 0);
    });
}

function mapLoadBalancerIds(loadBalancerDescription) {
  return loadBalancerDescription.LoadBalancerName;
}

function describeAll(aws) {
  return aws.elb.describeLoadBalancers();
}

function describe(aws) {
  return describeAll(aws)
    .then((results) => describeTags(aws, results
      .LoadBalancerDescriptions
      .map(mapLoadBalancerIds))
      .then((tags) => filterClusternatorTags(
        results.LoadBalancerDescriptions, tags)));
}

/**
 * @param {AwsWrapper} aws
 * @param {string[]} loadBalancerIds
 * @returns {Q.Promise}
 */
function describeTags(aws, loadBalancerIds) {
  return aws.elb
    .describeTags({ LoadBalancerNames: loadBalancerIds})
    .then((results) => results.TagDescriptions);
}

function enableAvailabilityZonesForLoadBalancer() {

}

function registerInstancesWithLoadBalancer() {

}

