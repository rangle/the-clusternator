'use strict';

module.exports = {
  create
};

class ElbTag {
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
 * @returns {ElbTag}
 */
function create(key, value) {
  return new ElbTag(key, value);
}
