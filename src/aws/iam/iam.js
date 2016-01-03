'use strict';

const constants = require('../../constants');

module.exports = {
  listServerCertificates,    // filtered for clusternator
  listAllServerCertificates, // _everything_ (analogue to aws.iam.listServer...)
  deleteServerCertificate,
  uploadServerCertificate
};

function createPolicy() {

}

function deletePolicy() {

}

function createPolicyVersion() {

}

function deletePolicyVersion() {

}

function createRole() {

}

function createUser() {

}

function deleteUser() {

}

function updateUser() {

}


function listRoles() {

}

function listUsers() {

}

function putUserPolicy() {

}

/**
 * @param {AwsWrapper} aws
 * @param {string} certificate
 * @param {string} privateKey
 * @param {string=} chain
 * @param {string=} certId
 * @returns {Q.Promise}
 */
function uploadServerCertificate(aws, certificate, privateKey, chain, certId) {
  if (!certificate || !privateKey) {
    throw new TypeError('uploadSererCertificate expects cert, and private key');
  }
  certId = certId ||
    `${constants.CLUSTERNATOR_PREFIX}-${(+Date.now()).toString(16)}`;
  chain = chain || '';
  if (certId.indexOf(constants.CLUSTERNATOR_PREFIX) !== 0) {
    certId = `${constants.clusternatorPrefix}${certId}`;
  }
  return aws.iam.uploadServerCertificate({
    CertificateBody: certificate,
    PrivateKey: privateKey,
    CertificateChain: chain,
    ServerCertificateName: certId
  });
}

/**
 * @param {AwsWrapper} aws
 * @param {string} certId
 * @returns {Q.Promise}
 * @throws {TypeError}
 */
function deleteServerCertificate(aws, certId) {
  if (!certId) {
    throw new TypeError('deleteServerCertificate requires a certId');
  }
  return aws.iam.deleteServerCertificate({ ServerCertificateName: certId });
}

/**
 * @param {{ ServerCertificateName: string }} item
 * @returns {boolean}
 */
function filterClusternatorTag(item) {
  return item
      .ServerCertificateName.indexOf(constants.CLUSTERNATOR_PREFIX) === 0;
}

/**
 * @param {{ ServerCertificateName: string, ServerCertificateId: string,
 Arn: string}} item
 * @returns {{certId: (string|*), awsId: *, arn: *}}
 */
function mapCertificateToSimple(item) {
  return {
    certId: item.ServerCertificateName,
    awsId: item.ServerCertificateId,
    arn: item.Arn
  };
}

/**
 * @param {AwsWrapper} aws
 * @returns {Q.Promise}
 */
function listAllServerCertificates(aws) {
  return aws.iam
    .listServerCertificates()
    .then((results) => results
      .ServerCertificateMetadataList
      .map(mapCertificateToSimple));
}

/**
 * @param {AwsWrapper} aws
 * @returns {Q.Promise}
 */
function listServerCertificates(aws) {
  return aws.iam
    .listServerCertificates()
    .then((results) => results
      .ServerCertificateMetadataList
      .filter(filterClusternatorTag)
      .map(mapCertificateToSimple));
}
