'use strict';
/**
 * This module contains functions that manage a project's private folder
 *
 * @module api/'0.1'/projectFs/private
 */

const PRIVATE_CHECKSUM = '.private-checksum';
const PROJECT_CREDS_FILE = 'aws-project-credentials.json';
const PROJECT_AWS_FILE = 'clusternator-aws.json';
const PROJECT_CN_CREDS_FILE = 'clusternator-project-credentials.json';

const Q = require('q');
const fs = require('./project-fs');

const cmn = require('../common');
const shaDir = cmn.src('cli-wrappers', 'generate-private-sha');
const util = cmn.src('/util');
const clusternatorJson = require('./clusternator-json');


module.exports = {
  checksum: privateChecksum,
  diff: privateDiff,
  writeProjectDetails,
  writeClusternatorCreds,
  addToIgnore,
  makePrivate,
  readPrivate
};


/**
 * @returns {Q.Promise}
 */
function privateChecksum() {
  return getPrivateChecksumPaths()
    .then((paths) => fs.mkdirp(paths.clusternator).then(() => paths))
    .then((paths) => {
      process.chdir(paths.root);
      return paths;
    }).then((paths) =>shaDir
      .genSha(paths.priv)
      .then((sha) => fs.write(paths.checksum, sha)
        .then(() => util
          .info(`Generated shasum of ${paths.priv} => ${sha}`))));
}

/**
 * @param {string} sha
 * @returns {Function}
 * @todo migrate process exit logic to a wrapper file in cli
 */
function getPrivateDiffFn(sha) {
  return (storedSha) => {
    if (sha.trim() === storedSha.trim()) {
      process.exit(0);
    }
    util.info(`Diff: ${sha.trim()} vs ${storedSha.trim()}`);
    process.exit(1);
  };
}

/**
 * @todo migrate process exit logic to a wrapper file in cli
 */
function privateDiff() {
  return getPrivateChecksumPaths()
    .then((paths) => shaDir
      .genSha(paths.priv)
      .then((sha) => fs.read(paths.checksum, 'utf8')
        .then(getPrivateDiffFn(sha))
        .fail(() => {
          // read file errors are expected
          util.info('Diff: no checksum to compare against');
          process.exit(2);
        })))
    .fail((err) => {
      // unexpected error case
      util.error(err);
      process.exit(2);
    });
}

/**
 * @returns {Q.Promise}
 */
function getPrivateChecksumPaths() {
  return Q.all([
      clusternatorJson.get(),
      fs.findProjectRoot() ])
    .then((results) => {
      const privatePath = results[0].private;
      const checksumPath = fs.path.join(results[1], results[0].clusternatorDir,
          PRIVATE_CHECKSUM);
      return {
        priv: privatePath,
        checksum: checksumPath,
        clusternator: results[0].clusternatorDir,
        root: results[1]
      };
    });
}

/**
 * @param {string} privatePath
 * @param {Object} creds
 * @returns {Q.Promise}
 */
function writeCreds(privatePath, creds) {
  util.info('NOTICE: Project Docker Credentials are being overwritten with ' +
    'new credentials, if there were previous credentials, they have been ' +
    'revoked. If you\'re reading this message, this will *not* impact you, ' +
    'however it *will* impact any other team members you\'re working with ' +
    'until your changes are committed to the master repo for this project');
  util.info('');
  return fs.write(
    fs.path.join(privatePath, PROJECT_CREDS_FILE),
    JSON.stringify(creds, null, 2), 'utf8');
}

/**
 * @param {string} privatePath
 * @param {Object} aws
 * @returns {Q.Promise}
 */
function writeAws(privatePath, aws) {
  return fs.write(
    fs.path.join(privatePath, PROJECT_AWS_FILE),
    JSON.stringify(aws, null, 2), 'utf8');
}

/**
 * @param {string} privatePath
 * @param {Object} details
 * @returns {Q.Promise<Object>}
 */
function writeProjectDetails(privatePath, details) {
  return Q.all([
    writeCreds(privatePath, details.credentials),
    writeAws(privatePath, details.aws)
  ]).then(() => details);
}

/**
 * @param {string} token
 * @param {string} privatePath
 * @private
 */
function writeClusternatorCreds_(token, privatePath) {
  return fs.write(fs.path.join(privatePath, PROJECT_CN_CREDS_FILE),
    JSON.stringify({token}, null, 2));
}

/**
 * @param {string} token
 * @param {string=} privatePath
 * @returns {Q.Promise}
 */
function writeClusternatorCreds(token, privatePath) {
  if (privatePath) {
    return writeClusternatorCreds_(token, privatePath);
  }
  return clusternatorJson
    .get()
    .then((cJson) => writeClusternatorCreds_(token, cJson.private));
}

/**
 * @param {string} ignoreFile
 * @param {string} privatePath
 * @returns {Q.Promise}
 */
function addToIgnore(ignoreFile, privatePath) {

  return clusternatorJson
    .readIgnoreFile(fs.path.join(fs.getSkeletonPath(), ignoreFile), true)
    .then((ignores) => ignores.concat(privatePath))
    .then((ignores) => clusternatorJson.addToIgnore(ignoreFile, ignores));
}

/**
 * @param {string} passphrase
 * @returns {Q.Promise}
 */
function makePrivate(passphrase) {
  return clusternatorJson.makePrivate(passphrase)
    .then(() => util.info('Clusternator: Private files/directories encrypted'));
}

/**
 * @param {string} passphrase
 * @returns {Q.Promise}
 */
function readPrivate(passphrase) {
  return clusternatorJson.readPrivate(passphrase)
    .then(() => util.info('Clusternator: Private files un-encrypted'));
}
