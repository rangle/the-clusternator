'use strict';

module.exports = {
  create
};

class ElbPortListener {
  /**
   * @param {number} instancePort
   * @param {number} publicPort
   * @param {string} instanceProtocol
   * @param {string} publicProtocol
   * @param {string=} sslCertId
   */
  constructor(instancePort, publicPort, instanceProtocol,
              publicProtocol, sslCertId) {

    this.InstancePort= instancePort;
    this.LoadBalancerPort= publicPort;
    this.InstanceProtocol= instanceProtocol;
    this.Protocol= publicProtocol;
    this.SSLCertificateId= sslCertId || '';
  }
}

/**
 * @param {number} instancePort
 * @param {number} publicPort
 * @param {string} instanceProtocol
 * @param {string} publicProtocol
 * @param {string=} sslCertId
 * @returns {ElbPortListener}
 */
function create(instancePort, publicPort, instanceProtocol,
                            publicProtocol, sslCertId) {
  return new ElbPortListener(instancePort, publicPort, instanceProtocol,
    publicProtocol, sslCertId);
}
