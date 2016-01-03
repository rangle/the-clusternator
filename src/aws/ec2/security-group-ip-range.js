'use strict';

module.exports = {
  create
};

class SgIpRange {
  /**
   * @param {string} cidrIp
   */
  constructor(cidrIp){
    this.CidrIp = cidrIp;
  }
}

/**
 * @param {string} cidrIp
 * @returns {SgIpRange}
 */
function create(cidrIp) {
  return new SgIpRange(cidrIp);
}
