'use strict';

/**
 * This module manages a project's `clusternator.json`
 *
 * @todo this module currently does way to much, pare it down
 * @module api/'0.1'/projectFs/clusternatorJson
 */

/** @todo make VCS_DIR configurable */
const VCS_DIR = '.git';
const GIT_EXTENSION = '.git';
const GIT_ORIGIN = 'remote "origin"';
const URL_SEP = '/';
const PACKAGE_JSON = 'package.json';
const BOWER_JSON = 'bower.json';
const FILENAME = 'clusternator.json';
const UTF8 = 'utf8';
const CLUSTERNATOR_TAR = 'clusternator.tar.gz';
const CLUSTERNATOR_PRIVATE = CLUSTERNATOR_TAR + '.asc';
const SKELETON =
  require('./skeletons/clusternator-json-skeleton');
const questions =
  require('./skeletons/create-interactive-questions');
const RX_NEWLINE = /\r?\n/;
const NEWLINE = '\r\n';
const DEFAULT_PORT_INTERNAL_NODE = 3000;
const DEFAULT_PORT_INTERNAL_STATIC = 80;
const DEFAULT_PORT_EXTERNAL = 80;

const Q = require('q');
const path = require('path');
const rimraf = Q.nfbind(require('rimraf'));

const fs = require('./project-fs');

const cmn = require('../common');

let git = Q.nfbind(require('parse-git-config'));
const util = cmn.src('util');
const gpg = cmn.src('cli-wrappers', 'gpg');
const tar = cmn.src('cli-wrappers', 'tar');

const GIT_CONFIG = VCS_DIR + path.sep + 'config';

function identity(obj) {
  return obj;
}

/**
 * @param {string} dirPath directory of project root
 * @returns {string}
 */
function fullPath(dirPath) {
  return path.join(dirPath, FILENAME);
}

/**
 * @param {string} url
 * @returns {string}
 */
function parseGitUrl(url) {
  const splits = url.split(URL_SEP).filter(identity);
  const result = splits[splits.length -1];
  const index = result.indexOf(GIT_EXTENSION);

  if (index === result.length - GIT_EXTENSION.length) {
    return result.slice(0, index);
  }
  return result;
}

function findGitName(projectRoot) {
  return git({ cwd: projectRoot, path: GIT_CONFIG }).then((config) => {
    if (!config || !config[GIT_ORIGIN] || !config[GIT_ORIGIN].url) {
      throw new Error('Unexpected Git Config');
    }
    return parseGitUrl(config[GIT_ORIGIN].url);
  });
}

/**
 * @param {string} projectRoot
 * @returns {string}
 */
function findPackageName(projectRoot) {
  try {
    return require(path.join(projectRoot, PACKAGE_JSON)).name;
  } catch(err) {
    return '';
  }
}

/**
 * @param {string} projectRoot
 * @return {string}
 */
function findBowerName(projectRoot) {
  try {
    return require(path.join(projectRoot, BOWER_JSON)).name;
  } catch(err) {
    return '';
  }
}

/**
 * @param {string[]} strings
 * @returns {Array}
 */
function deDupe(strings) {
  const newCollection = [];
  strings.forEach((str) => {
    if (!str) {
      return;
    }
    if (newCollection.indexOf(str) === -1) {
      newCollection.push(str);
    }
  });
  return newCollection;
}

/**
 * @param {string} projectRoot
 * @returns {Q.Promise<string[]>}
 */
function findProjectNames(projectRoot) {
  const names = [
    findBowerName(projectRoot),
    findPackageName(projectRoot)
  ];

  return findGitName(projectRoot).then((name) => {
    names.unshift(name);
    return deDupe(names);
  }, () => {
    return deDupe(names);
  });
}


function validate(cJson) {
  const C = 'culsternator.json requires ';

  let hasFailed = false;
  const results = {};

  if (!cJson.projectId) {
    hasFailed = true;
    results.projectId = C + 'projectId';
  }
  if (!cJson.appDefs) {
    hasFailed = true;
    results.projectId = C + 'an appDefs object';
  } else {
    if (!cJson.appDefs.pr) {
      hasFailed = true;
      results.projectId = C + 'an appDefs.pr object, or pointer (string)';
    }
  }
  if (hasFailed) {
    return results;
  }
  results.ok = true;
  return results;
}

/**
 * @param {Object} mainAnswers
 * @param {Object} portAnswers
 * @returns {boolean}
 */
function addPortAnswer(mainAnswers, portAnswers) {
  if (!mainAnswers.ports) {
    mainAnswers.ports = [];
  }
  const arePortsValid = mainAnswers.ports.reduce((prev, curr) => {
    if (prev === false) {
      return false;
    }
    if (portAnswers.portInternal === curr.portInternal) {
      return false;
    }
    if (portAnswers.portExternal === curr.portExternal) {
      return false;
    }
    return true;
  }, true);
  if (!arePortsValid) {
    return false;
  }
  mainAnswers.ports.push({
    portInternal: portAnswers.portInternal,
    portExternal: portAnswers.portExternal,
    protocol: portAnswers.protocol
  });
  return true;
}

function getDefaultPorts(answers, skipDefaults) {
  if (skipDefaults) {
    return { portInternal: '', portExternal: '' };
  }
  if (answers.backend !== 'static') {
    return {
      portExternal: DEFAULT_PORT_EXTERNAL,
      portInternal: DEFAULT_PORT_INTERNAL_NODE
    };
  }
  return {
    portExternal: DEFAULT_PORT_EXTERNAL,
    portInternal: DEFAULT_PORT_INTERNAL_STATIC
  };
}

function promptPorts(answers, skipDefaults) {
  const ports = questions.projectPorts(getDefaultPorts(answers, skipDefaults));
  return util
    .inquirerPrompt(ports)
    .then((portAnswers) => {
      if (!addPortAnswer(answers, portAnswers)) {
        util.warn(`${portAnswers.portInternal}:${portAnswers.portExternal} ` +
        ` was not added.  The internal, or external port is already in mapped`);
      }
      if (portAnswers.moar) {
        return promptPorts(answers, true);
      }
      return answers;
    });
}

/**
 * @param {Object=} params
 * @returns {Q.Promise<Array>}
 */
function createInteractive(params) {
  const init = questions.projectInit(params);

  return util
    .inquirerPrompt(init)
    .then(promptPorts);
}

/**
 * Rejects if the file exists, resolves otherwise
 * @param {string} dir
 * @returns {Q.Promise}
 */
function skipIfExists(dir) {
  dir = fullPath(dir);
  return fs.read(dir)
    .then(() => {
    throw new Error(dir + ' already exists.');
  }, (err) => null); // fail over
}

/**
 * @param {string} root
 * @returns {Q.Promise}
 * @private
 */
function privateExists_(root) {
  const dir = path.join(root, CLUSTERNATOR_PRIVATE);
  return fs.read(dir).then(() => {
    return dir;
  }, (err) => {
    util.info(`Clusternator: Encrypted Private File: ${dir} does not exist, or
    is unreadable`);
    throw err;
  });
}

/**
 * Resolves if the
 * @returns {Q.Promise}
 */
function privateExists() {
  return fs.findProjectRoot()
    .then((root) => {
      return privateExists_(root);
  });
}

/**
 * @param {Object} answers
 * @return {string}
 */
function answersToClusternatorJSON(answers) {
  answers.private = answers.private || [];

  const config = util.clone(SKELETON);

  config.projectId = answers.projectId;
  config.private = answers.private;
  config.deploymentsDir = answers.deploymentsDir;

  return JSON.stringify(config, null, 2);
}

/**
 * @param {answers} Object
 * @return {Q.Promise}
 */
function writeFromAnswers(answers) {
  const json = answersToClusternatorJSON(answers);
  const dir = fullPath(answers.root);
  return fs.write(dir, json, UTF8)
    .then(() => answers);
}

function getConfigFrom(root) {
  const file = fullPath(root);
  return fs.read(file, UTF8).then((file) => {
    return JSON.parse(file);
  });
}

/**
 * @return {Q.Promise<Object>}
 */
function getConfig() {
  return fs.findProjectRoot()
    .then(getConfigFrom);
}

/**
 * @param {string} tarPath
 * @returns {Q.Promise}
 */
function untar(tarPath) {
  return tar
    .extract(tarPath)
    .then(() => rimraf(tarPath));
}

/**
 * @param {string} passPhrase
 * @param {string} root=
 * @returns {Q.Promise}
 */
function readPrivate(passPhrase, root) {
  if (!root) {
    return fs.findProjectRoot()
      .then(readPrivateFromRoot);
  } else {
    return readPrivateFromRoot(root);
  }

  function readPrivateFromRoot(root) {
    return privateExists_(root)
      .then(() => {
        const gpgPath = path.join(root, CLUSTERNATOR_PRIVATE);
        const tarPath = path.join(root, CLUSTERNATOR_TAR);

        return gpg
          .decryptFile(passPhrase, gpgPath, tarPath)
          .then(() => untar(tarPath));
      });
  }
}

/**
 * Given a passphase make private tars, and encrypts a config's private section
 * @param {String} passPhrase
 * @returns {Q.Promise}
 */
function makePrivate(passphrase, root) {
  return getConfig().then((config) => {
    if (!config.private) {
      throw new Error(
        'Clusternator: No private assets marked in config file');
    }

    function makePrivateFromRoot(root) {
      const tarFile = path.join(root, CLUSTERNATOR_TAR);
      return fs.assertAccessible(config.private)
        .then(() => tar.ball(tarFile, config.private))
        .then(() => gpg.encryptFile(passphrase, tarFile))
        .then(() => Q
          .allSettled(
            [config.private].concat([rimraf(tarFile)])));
    }

    if (root) {
      return makePrivateFromRoot(root);
    }
    return fs.findProjectRoot()
      .then(makePrivateFromRoot);
  });
}

/**
 * @param {string} ignoreFileName
 * @returns {Q.Promise<string>}
 */
function ignorePath(ignoreFileName) {
  return fs.findProjectRoot()
    .then((root) => path.join(root, ignoreFileName));
}


/**
 * @param {string} file
 * @returns {string[]}
 */
function splitIgnoreFile(file) {
  return file.split(RX_NEWLINE);
}

/**
 * @param {string} file
 * @return {Q.Promise<string[]>}
 */
function readAndSplitIgnore(file) {
  return fs.read(file, UTF8)
    .then(splitIgnoreFile)
    .fail(() => []);
}

/**
 * @param {string} ignoreFileName
 * @param {boolean=} isFullPath defaults to false
 * @returns {Q.Promise<string[]>}
 */
function readIgnoreFile(ignoreFileName, isFullPath) {
  if (isFullPath) {
    return readAndSplitIgnore(ignoreFileName);
  }
  return ignorePath(ignoreFileName)
    .then(readAndSplitIgnore);
}

/**
 * @param {string} toIgnore
 * @param {string[]} ignores
 * @returns {boolean}
 */
function ignoreHasItem(toIgnore, ignores) {
  let found = false;
  ignores.forEach((str) => {
    if (str.indexOf(toIgnore) === 0) {
      found = true;
    }
  });
  return found;
}

/**
 * @param {string} ignoreFileName
 * @param {string|string[]} toIgnore
 * @returns {Request|Promise.<T>|*}
 */
function addToIgnore(ignoreFileName, toIgnore) {
  if (!Array.isArray(toIgnore)) {
    toIgnore = [toIgnore];
  }
  return ignorePath(ignoreFileName)
    .then((path) => fs.read(path, UTF8)
      .fail(() => '')) // not all starters might have ignore file, fail over
    .then((rawIgnore) => {
      const ignores = splitIgnoreFile(rawIgnore);
      const newIgnores = toIgnore
        .filter((item) => ignores.indexOf(item) === -1);

      if (!newIgnores.length) {
        // items already exists
        return Q.resolve();
      }

      return ignorePath(ignoreFileName)
        .then((ignoreOutputFile) => {
          const output = NEWLINE + rawIgnore + NEWLINE +
            newIgnores.join(NEWLINE) + NEWLINE;
          return fs.write(ignoreOutputFile, output);
        });
    });
}

/**
 * @returns {Q.Promise<string>}
 */
function getProjectRootRejectIfClusternatorJsonExists() {
  return fs.findProjectRoot()
    .then((root) => skipIfExists(root)
      .then(() => root));
}


module.exports = {
  createInteractive,
  skipIfExists,
  findProjectNames,
  getProjectRootRejectIfClusternatorJsonExists,
  fullPath,
  get: getConfig,
  getFrom: getConfigFrom,
  privateExists,
  readPrivate,
  makePrivate,
  validate,
  writeFromAnswers,
  addToIgnore,
  readIgnoreFile,
  FILENAME,
  CLUSTERNATOR_PRIVATE,
  helpers: {
    parseGitUrl,
    findGitName,
    findPackageName,
    findBowerName,
    deDupe,
    answersToClusternatorJSON,
    ignorePath,
    readIgnoreFile,
    ignoreHasItem,
  }
};
