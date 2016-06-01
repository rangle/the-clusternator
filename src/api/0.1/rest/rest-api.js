'use strict';
/**
 * This module is used by the server to provide a REST interface to the CLI
 * @module api/'0.1'/rest
 * @version 0.1.0
 */

const inspect = require('util').inspect;
const Q = require('q');
const R = require('ramda');
const cn = require('../js/js-api');
const cmn = require('../common');

const constants = cmn.src('constants');
const util = cmn.src('util');

const users = cmn.src('server','auth','users');

const gpg = cmn.src('cli-wrappers', 'gpg');
const slack = cmn.src('cli-wrappers','slack');

const DEFAULT_AUTHORITY = 2;

const STATE = {
  config: null,
  pm: null,
  db: null
};

const INVALID_CHANNEL_NAME = 'Channel names must be 21 characters or fewer,'
+ 'lower case, and cannot contain spaces or periods.';

module.exports = getCommands;

const EXPORTS = {
  user: {
    create: (body) => createUser(body),
    passwd: (body) => changePass(body)
  },
  project: {
    'create-data': createData,
    'reset-auth-token': resetAuthToken,
    'reset-shared-key': resetSharedKey,
    'reset-git-hub-key': resetGitHubKey,
    'shared-key': sharedKey,
    'git-hub-key': gitHubKey,
    'change-slack-channel': changeSlackChannel,
    create: createProject,
    'list-ssh-instances': listSSHAbleInstances,
    destroy: pmDestroy,
    list: listProjects
  },
  pr: {
    create: prCreate,
    destroy: prDestroy
  },
  deployment: {
    create: pmCreateDeployment,
    destroy: pmDestroyDeployment
  },
  authorities: {
    list: listAuthorities
  }
};


/**
 * @param {*} pr
 * @returns {string}
 */
function sanitizePr(pr) {
  pr = parseInt(pr, 10);
  pr = pr !== pr ? 0 : pr;
  return pr + '';
}

/**
 * @param {{ projectId: string }} body
 * @returns {Q.Promise<string[]>}
 */
function listProjects(body) {
  return state()
    .then((s) => s
      .pm.listProjects());
}


/**
 * @param {{ projectId: string }} body
 * @returns {Q.Promise<string[]>}
 */
function listSSHAbleInstances(body) {
  if (!body || !body.projectId) {
    return Q.reject(
      new Error('list-ssh-instances: requires projectId, given: ' +
        inspect(body)));
  }
  const projectId = body.projectId + '';
  return state()
    .then((s) => s
      .pm.listSSHAbleInstances(projectId));
}

/**
 * @returns {Q.Promise<string[]>}
 */
function listAuthorities() {
  return state()
    .then((s) => s.config.commandPrivileges);
}

function newProjectUser(id){
  const password = Math.random() + (+Date.now()).toString(16);
  return users.create({
    id: constants.PROJECT_USER_TAG + id,
    password: password,
    authority: 0
  });
}

function newProjectToken(id) {
  if (id.indexOf(constants.PROJECT_USER_TAG === 0)) {
    return newToken(id);
  }
  return newToken(constants.PROJECT_USER_TAG + id);
}

function createIfNotFound(s, projectId, repoName) {
  const details = {
    id: projectId,
    repo: repoName
  };
  return Q.all([
      newProjectToken(projectId),
      newKey(details, 'gitHubKey'),
      newKey(details, 'sharedKey'),
      newProjectUser(details.id) ])
    .then((results) => {
      details.gitHubKey = results[1].gitHubKey;
      details.sharedKey = results[2].sharedKey;
      return s.db(projectId, details)()
        .then(() => results);
    });
}

/**
 * @param {{ projectId: string }} body
 * @param {{ channel: string }} body
 * @returns {Q.Promise<{ data: string }>}
 */
function changeSlackChannel(body) {
  if (!util.validSlackChannel(body.channel)){
    return Q.reject(new Error(INVALID_CHANNEL_NAME));
  }

  return state()
    .then((s) => s
      .db(body.projectId)()
      .then((details) => {
        return s.db(body.projectId,
          R.merge(details, {channel: body.channel}))()
        .then(() => {
          return {
            data: `Successfully changed ${body.projectId}'s slack channel to `
            + `${body.channel}`};
        });
      }));
}

/**
 * @param {{ id: string }} details
 * @param { name } repoName
 * @returns {Q.Promise<Object[]>}
 */
function resetData(details, repoName) {
  details.repo = repoName || details.repo || details.id;
  return Q
    .all([
      newProjectToken(details.id),
      newKey(details, 'gitHubKey'),
      newKey(details, 'sharedKey') ]);
}

/**
 * @param {{ db: { setItem: function() }}} s
 * @param {{ gitHubKey: string, sharedKey: string }} row
 * @param {string} projectId
 * @param {string} repoName
 * @returns {Promise}
 */
function resetIfFound(s, row, projectId, repoName) {
  return resetData(row, repoName)
    .then((result) => {
      row.gitHubKey = result[1].gitHubKey;
      row.sharedKey = result[2].sharedKey;
      return s.db(projectId, row)()
        .then(() => result);
    });
}

/**
 * @param {{ db: { find: function(): Promise }}} s
 * @param {string} projectId
 * @param {string} repoName
 * @returns {Promise}
 */
function findOrCreate(s, projectId, repoName) {
  return s
    .db(projectId)()
    .then((row) => resetIfFound(s, row, projectId, repoName),
      () => createIfNotFound(s, projectId, repoName));
}

/**
 * @param {{ projectId: string }} body
 * @returns {Promise}
 */
function createData(body) {
  if (!body || !body.projectId) {
    return Q.reject(new Error('Project requires a projectId'));
  }
  body.projectId += '';
  body.repoName = body.repoName + '' || body.projectId;

  util.info(`creating project data for ${body.projectId}`);
  return state()
    .then((s) => findOrCreate(s, body.projectId, body.repoName)
      .then((results) => {
        return {
          authToken: results[0],
          gitHubKey: results[1].gitHubKey,
          sharedKey: results[2].sharedKey
        };
      }));
}

/**
 * @param {string} projectId
 * @returns {Q.Promise<string>}
 */
function newToken(projectId) {
  return users.tokens.clear(makeTokenName(projectId))
    .then(() => users.tokens.create(makeTokenName(projectId)));
}

/**
 * @param {{ projectId: string}} body
 * @returns {Q.Promise<{ data: string }>}
 */
function resetAuthToken(body) {
  if (!body || !body.projectId) {
    return Q.reject(new Error('Project requires a projectId'));
  }
  return newToken(body.projectId)
    .then((token) => {
      return { data: token };
    });
}

/**
 * @param {{ projectId: string}} body
 * @param {string} attr
 * @returns {Q.Promise<string>}
 */
function getKey(body, attr) {
  if (!body || !body.projectId) {
    return Q.reject(new Error('Project requires a projectId'));
  }
  return state()
    .then((s) => s
      .db(body.projectId)()
      .then((details) => {
        return { data: details[attr] };
      }));
}

/**
 * @param {Object} dbRow
 * @param {string} attr
 * @returns {Object}
 */
function newKey(dbRow, attr) {
  return gpg
    .generatePass()
    .then((pass) => {
      dbRow[attr] = pass;
      return dbRow;
    });
}

/**
 * @param {{ projectId: string}} body
 * @param {string} attr
 * @returns {Q.Promise<string>}
 */
function resetKey(body, attr) {
  if (!body || !body.projectId) {
    return Q.reject(new Error('Project requires a projectId'));
  }
  return state()
    .then((s) => s
      .db(body.projectId)()
      .then((details) => newKey(details, attr))
      .then((details) => s
        .db(body.projectId, details)()
        .then(() => {
          return { data: details[attr] };
        })));
}

/**
 * @param {{ projectId: string }} body
 * @returns {Q.Promise<{ data: string }>}
 */
function resetSharedKey(body) {
  return resetKey(body, 'sharedKey');
}

/**
 * @param {{ projectId: string }} body
 * @returns {Q.Promise<{ data: string }>}
 */
function resetGitHubKey(body) {
  return resetKey(body, 'gitHubKey');
}

/**
 * @param {{ projectId: string }} body
 * @returns {Q.Promise<{ data: string }>}
 */
function sharedKey(body) {
  return getKey(body, 'sharedKey');
}

/**
 * @param {{ projectId: string }} body
 * @returns {Q.Promise<{ data: string }>}
 */
function gitHubKey(body) {
  return getKey(body, 'gitHubKey');
}


// XXX: this is here because the CLI and CI clients are sending
// different data types for the appdef.
function readAppDefHack(appDef) {
  if(typeof appDef === 'string') {
    return JSON.parse(appDef);
  } else if(typeof appDef === 'object') {
    return appDef;
  } else {
    throw 'Invalid appdef';
  }
}

/**
 * @param {Object} body
 * @returns {Q.Promise}
 */
function pmCreateDeployment(body) {
  return state()
    .then((s) => {
      const d = Q.defer(); // For early async resolution (see below)
      const deployment = body.deployment + '';

      const projectId = body.repo;
      const sshData = body.sshKeys;
      const appDef = readAppDefHack(body.appDef);


      s.db(projectId)()
        .then((project) => {
          // This is an endpoint and it cannot wait 7 minutes for resolution
          // This at least checks the db to see if it is valid then resolves
          // before the long call
          d.resolve();
          return s
            .pm.createDeployment(projectId, deployment + '', appDef, sshData,
              true)
            .then((url) => slack
              .message(`Create: ${projectId} deployment ${deployment} ` +
                'successful.  Application will be available at ' +
                `<https://${url}>`,
                project.channel))
            .fail((err) => {
              slack.message(`Create: ${projectId} deployment ${deployment} ` +
                `failed: ${err.message}`, project.channel);
              throw err;
            });
        }).fail(d.reject);
      return d.promise;
    });
}

function pmDestroyDeployment(body) {
  return state()
    .then((s) => {
      const d = Q.defer(); // For early async resolution (see below)
      const deployment = body.deployment + '';
      const projectId = body.repo;

      s.db(projectId)()
        .then((project) => {
          d.resolve();
          return s
            .pm.destroyDeployment(projectId, deployment)
            .then(() => {
              util.info(projectId + ':' + deployment + ' destroyed');
            })
            .fail((err) => {
              util.error(err);
              slack.message(`Destroy: ${projectId} deployment ${deployment} ` +
                `failed: ${err.message}`, project.channel);
              throw err;
            });
        }).fail(d.reject);
      return d.promise;
    });
}

function prCreate(body) {
  return state()
    .then((s) => {
      const d = Q.defer(); // For early async resolution (see below)
      const pr = sanitizePr(body.pr);
      const build = sanitizePr(body.build);
      const appDef = readAppDefHack(body.appDef);
      const projectId = body.repo;
      const sshData = body.sshKeys;

      s.db(projectId)()
        .then((project) => {
          // This is an endpoint and it cannot wait 7 minutes for resolution
          // This at least checks the db to see if it is valid then resolves
          // before the long call
          d.resolve();
          return s
            .pm.createPR(projectId, pr + '', appDef, sshData)
            .then((url) => slack
              .message(`Create: ${projectId}, PR ${pr} Build #` +
                `${build} successful.  Application will be available at ` +
                `<https://${url}>`, project.channel))
            .fail((err) => {
              slack.message(`Create: ${projectId}, PR ${pr} ` +
                `failed: ${err.message}`, project.channel);
              throw err;
            });
        }).fail(d.reject);
      return d.promise;
    });
}

/**
 * @param {{ id: string, pr: string }} body
 * @returns {Q.Promise}
 */
function prDestroy(body) {
  return state()
    .then((s) => s
      .db(body.id)()
      .then((project) => s
        .pm.destroyPR(project.id, sanitizePr(body.pr))));
}

/**
 * @returns {Q.Promise}
 */
function pmDestroy() {
  const args = Array.prototype.slice.call(arguments, 0);
  return state()
    .then((s) => s.pm.destroy.apply(null, args));

}

/**
 * @param {{ projectId: string }} body
 * @returns {body.projectId}
 */
function createProject(body) {
  if (!body.projectId) {
    return Q.reject(new Error('No projectId given in post request'));
  }
  util.info('Attempting to create project:', body.projectId);
  return state()
    .then((s) => s
      .pm.create(body.projectId));
}

/**
 * @param {{ username: string, password: string }} body
 * @returns {Q.Promise}
 */
function changePass(body) {
  if (!body.username) {
    return Q.reject(new Error('Create user requires a username'));
  }
  if (!body.password) {
    return Q.reject(new Error('Create user requires a password'));
  }

  return users.password(body.username, body.password, body.passwordNew);
}

/**
 * @param {{ username: string, password: string, authority: number= }} body
 */
function createUser(body) {
  if (!body.username) {
    return Q.reject(new Error('Create user requires a username'));
  }
  if (!body.password) {
    return Q.reject(new Error('Create user requires a password'));
  }

  body.authority = +body.authority >= 0 ? +body.authority : DEFAULT_AUTHORITY;
  return users.create({
    id: body.username,
    password: body.password,
    authority: body.authority
  });
}

/**
 * @param {{ config: Object, db: Object, pm: Object }} state
 * @returns {Q.Promise<{ config: Object, db: Object, pm: Object }>}
 */
function initPmState(state) {
  state.pm = cn.awsProjectManager(state.config);
  return Q.resolve(state);
}

/**
 * @param {Object} config
 * @param {object} projectDb
 * @returns {Q.Promise<{ config: Object, db: Object, pm: Object }>}
 */
function init(config, projectDb) {
  const state = STATE;
  state.config = config;
  state.db = projectDb;
  state.pm = null;
  return initPmState(state)
  .then(() => state);
}

/**
 * @param projectId
 * @returns {*}
 */
function makeTokenName(projectId) {
  projectId = projectId + '';
  return  constants.PROJECT_USER_TAG + projectId;
}

/**
 * @param {Object=} config
 * @returns {Q.Promise<{ config: Object, db: Object, pm: Object }>}
 */
function state(config) {
  if (STATE.config && STATE.db && STATE.pm) {
    return Q.resolve(STATE);
  }
  if (STATE.config) {
    return init(STATE.config);
  }
  if (config) {
    return init(config);
  }
  return Q.reject(new Error('unable to find/allocate state'));
}

/**
 * @param config
 * @param projectDb
 * @returns {{}}
 */
function getCommands(config, projectDb) {

  init(config, projectDb);

  return EXPORTS;
}
