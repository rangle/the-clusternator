'use strict';
/**
 * This module manages the installation of clusternator scripts into a project's
 * file system
 *
 * @module api/'0.1'/projectFs/clusternatorScripts
 */

const SERVE_SH = 'serve.sh';
const DECRYPT_SH = 'decrypt.sh';
const DOCKER_BUILD_JS = 'docker-build.js';
const NOTIFY_JS = 'notify.js';
const DEFAULT_API = /\$DEFAULT_API/g;
const HOST = /\$HOST/g;

const Q = require('q');

const fs = require('./project-fs');
const circle = require('./circle-ci');
const cmn = require('../common');

const util = cmn.src('util');
const constants = cmn.src('constants');

module.exports = {
  init: initializeScripts,
  initOptional
};

/**
 * @param {string} clustDir
 * @param {string} tld
 * @returns {Q.promise}
 */
function initializeScripts(clustDir, tld) {
  return fs.mkdirp(clustDir).then(() => {
    const decryptPath = fs.path.join(clustDir, DECRYPT_SH);
    const dockerBuildPath = fs.path.join(clustDir, DOCKER_BUILD_JS);
    const clusternatorPath = fs.path.join(clustDir, NOTIFY_JS);

    return Q
      .all([
        fs.getSkeleton(DECRYPT_SH)
          .then((contents) => fs.installExecutable(decryptPath, contents)),
        fs.getSkeleton(DOCKER_BUILD_JS)
          .then((contents) => fs.write(dockerBuildPath, contents)),
        fs.getSkeleton(NOTIFY_JS)
          .then((contents) => contents
            .replace(HOST, tld)
            .replace(DEFAULT_API, constants.DEFAULT_API_VERSION))
          .then((contents) => fs.write(clusternatorPath, contents))]);
  });
}

/**
 * @param {{ deploymentsDir: string, clusternatorDir: string,
 projectId: string, backend: string, tld: string, circleCi: boolean,
 gitHubOwner: string }} options
 * @param {string} projectRoot
 * @returns {Request|Promise.<T>|*}
 */
function initOptional(options, projectRoot) {
  let promises = [];

  if (options.circleCI) {
    promises.push(circle.init(projectRoot, options.clusternatorDir,
      options.gitHubOwner, options.backend));
  }
  if (options.backend !== 'static') {
    promises.push(initializeServeSh(
      fs.path.join(projectRoot, options.clusternatorDir)));
  }
  return Q.all(promises);
}

/**
 * @param {string} root
 * @returns {Q.Promise}
 */
function initializeServeSh(root) {
  const sPath = fs.path.join(root, SERVE_SH);
  return fs.getSkeleton(SERVE_SH)
    .then((contents) => {
      return fs.write(sPath, contents);
    })
    .then(() => {
      return fs.chmod(sPath, '755');
    });
}
