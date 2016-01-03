'use strict';

const constants = require('../../constants');

module.exports = {
  create,
  createVpc,
  createTag,
  createTagKey,
  createClusternator
};

class Filter {
  /**
   * @param {string} name
   * @param {string|string[]} values
   */
  constructor(name, values) {
    this.Name = name;
    this.Values = Array.isArray(values) ? values : [values];
  }
}

/**
 * @param {string} name
 * @param {string|string[]} values
 * @returns {Filter}
 */
function create(name, values) {
  return new Filter(name, values);
}

/**
 * @param {string|string[]} values
 * @returns {Filter}
 */
function createVpc(values) {
  return new Filter('vpc-id', values);
}


/**
 * @param {string} tagName
 * @param {string|string[]} values
 * @returns {Filter}
 */
function createTag(tagName, values) {
  return new Filter('tag:' + tagName, values);
}

/**
 * @param {string|string[]} values
 * @returns {Filter}
 */
function createTagKey(values) {
  return new Filter('tag-key', values);
}

/**
 * @returns {Filter}
 */
function createClusternator() {
  return createTagKey(constants.CLUSTERNATOR_TAG);
}
