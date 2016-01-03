'use strict';

module.exports = {
  create,
  tag
};

/**
 * @param {AwsWrapper} aws
 * @param {string[]} resources
 * @param {Ec2Tag[]} tags
 */
function tag(aws, resources, tags) {
  return aws.ec2.createTags({
    Resources: resources,
    Tags: tags
  });
}

class Ec2Tag {
  /**
   * @param {string} key
   * @param {string} value
   */
  constructor(key, value) {
    this.Key= key;
    this.Value= value;
  }
}

/**
 * @param {string} key
 * @param {string} value
 * @returns {Ec2Tag}
 */
function create(key, value) {
  return new Ec2Tag(key, value);
}
