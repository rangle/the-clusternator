'use strict';

const constants = require('../../constants');

module.exports = {
  create,
  destroy,
  describe,
  list
};

/**
 * @param {string} name
 * @returns {string}
 */
function clusternateRepositoryName(name) {
  if (name.indexOf(constants.CLUSTERNATOR_PREFIX) !== 0) {
    name = constants.CLUSTERNATOR_PREFIX + name;
  }
  return name;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} name
 * @returns {Q.Promise}
 */
function create(aws, name) {
  name = clusternateRepositoryName(name);
  return aws.ecr.createRepository({
    repositoryName: name
  });
}

/**
 * @param {AwsWrapper} aws
 * @param {string} name
 * @returns {Q.Promise}
 */
function destroy(aws, name) {
  name = clusternateRepositoryName(name);
  return aws.ecr.deleteRepositroy({
    repositoryName: name
  });
}

/**
 * @param {AwsWrapper} aws
 * @returns {Q.Promise}
 */
function describe(aws) {
  return aws.ecr.describeRepositories();
}

function list() {

}