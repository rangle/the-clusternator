'use strict';
/**
 * This module manages dealing with CircleCI files, specifically adding
 clusternator commands to them

 * @module api/'0.1'/projectFs/circleCi
 */

const CLUSTERNATOR_DIR = /\$CLUSTERNATOR_DIR/g;
const OWNER = /\$OWNER/g;
const NODE_FULL_VERSION = /\$NODE_FULL_VERSION/g;
const UTF8 = 'utf8';
const CIRCLEFILE = 'circle.yml';

const merge = require('deepmerge');
const Q = require('q');
const YAML = require('yamljs');

const fs = require('./project-fs');
const supportedAppBackends = require('./supported-app-backends');

module.exports = {
  loadExistingCircleCIFile,
  initializeCircleCIFile,
  init
};

/**
 * @param {string} fullPath
 * @param {function(...):string=} filter
 * @returns {Q.Promise<Object>}
 */
function loadCircleCIFile(fullPath, filter) {
  return fs.read(fullPath, UTF8)
    .then((contents) => {
      if (typeof filter === 'function') {
        contents = filter(contents);
      }
      if (!contents) {
        // circle.yml is an empty file case
        return {};
      }
      return YAML.parse(contents);
    })
    .fail(() => {
      return {};
    });
}

/**
 * @param {string} root
 * @returns {Q.Promise}
 */
function loadExistingCircleCIFile(root) {
  return loadCircleCIFile(fs.path.join(root, CIRCLEFILE));
}

/**
 * @param {string} clustDir
 * @param {string} owner
 * @return {Q.Promise<string>}
 */
function getCircleSkeleton(clustDir, owner, backend) {
  return loadCircleCIFile(fs.path.join(fs.getSkeletonPath(), CIRCLEFILE),
    (f) => f
      .replace(CLUSTERNATOR_DIR, clustDir)
      .replace(OWNER, owner)
      .replace(
        NODE_FULL_VERSION,
        supportedAppBackends[backend].options.NODE_FULL_VERSION));
}

/**
 * @param {string} root
 * @param {string} clustDir
 * @param {string} owner
 * @returns {Q.Promise<string>}
 */
function initializeCircleCIFile(root, clustDir, owner, backend) {
  return Q
    .all([
      getCircleSkeleton(clustDir, owner, backend),
      loadExistingCircleCIFile(root) ])
    .then((results) => YAML
      .stringify(merge(results[0], results[1]), 5));
}

/**
 * @param {string} root
 * @param {string} clustDir
 * @param {string} owner
 * @returns {Q.Promise}
 */
function init(root, clustDir, owner, backend) {
  return initializeCircleCIFile(root, clustDir, owner, backend)
    .then((text) => fs.write(fs.path.join(root, CIRCLEFILE), text));
}
