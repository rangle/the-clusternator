'use strict';
/**
 * This module encapsulates file system commands relating to Docker, and
 * Dockerfiles
 *
 * @module api/'0.1'/projectFs/docker
 */
const DOCKERFILE = 'Dockerfile';
const DOCKERFILE_NODE_LATEST = 'dockerfile-node-latest';
const DOCKERFILE_STATIC_LATEST = 'dockerfile-static-latest';

const fs = require('./project-fs');
const privateFs = require('./private');
const supportedAppBackends = require('./supported-app-backends');
const cmn = require('../common');

const docker = cmn.src('cli-wrappers', 'docker');
const util = cmn.src('util');
const constants = cmn.src('constants');

module.exports = {
  init: initializeDockerFile,
  build: dockerBuild
};

/**
 *
 * @param {string} clustDir
 * @param {string} backendType
 * @param {number=} port
 * @returns {Q.Promise}
 */
function initializeDockerFile(clustDir, backendType, port) {
  const backend = supportedAppBackends[backendType || 'static' ];
  const options = Object.assign({}, backend.options, {
    EXTERNAL_PORT: port
  });

  return fs
    .findProjectRoot()
    .then((root) => fs.getSkeleton(backend.dockerTemplate)
      .then((contents) => {
        Object.keys(options)
          .map(k => contents = contents.replace(
            new RegExp('\\$' + k, 'g'),
            options[k]));

        return fs.write(fs.path.join(root, DOCKERFILE), contents);
      }));
}

/**
 * @param name
 * @param passphrase
 * @returns {Request|*|Promise.<T>}
 */
function dockerBuild(name, passphrase) {
  return privateFs.makePrivate(passphrase).then(() => {
    return fs
      .findProjectRoot()
      .then((root) => {
        let output;
        let outputError;
        process.chdir(root);
        util.info('Start Docker Build', name);
        return docker.build(name)
          .progress((data) => {
            if (!data) {
              return;
            }
            if (data.error) {
              outputError += data.error;
              util.error(outputError);
            }
            if (data.data) {
              output += data.data;
              util.verbose(output);
            }
          });
      })
      .then(() => {
        util.verbose('Decrypting Private Folder');
        return privateFs.readPrivate(passphrase);
      })
      .then(() => {
        util.info('Built Docker Image: ', name);
      })
      .fail((err) => {
        util.warn('Docker failed to build: ', err.message);
        return privateFs.readPrivate(passphrase);
      });
  });
}
