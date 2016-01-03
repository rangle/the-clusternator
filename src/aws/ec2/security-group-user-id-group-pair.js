'use strict';

module.exports = {
  create
};

class SgUserIdGroupPair {
  /**
   * @param {string} groupId
   */
  constructor(groupId){
    this.GroupId = groupId;
  }
}

/**
 * @param {string} groupId
 * @returns {SgUserIdGroupPair}
 */
function create(groupId) {
  return new SgUserIdGroupPair(groupId);
}