'use strict';
/**
 * @module constants
 */

const CLUSTERNATOR_PREFIX = 'clusternator';
const DELIM = '-';
const CLUSTERNATOR_TAG = CLUSTERNATOR_PREFIX + DELIM + 'created';
const DEPLOYMENT_TAG = CLUSTERNATOR_PREFIX + DELIM + 'deployment';
const EXPIRES_TAG = CLUSTERNATOR_PREFIX + DELIM + 'expires';
const PROJECT_TAG = CLUSTERNATOR_PREFIX + DELIM + 'project';
const PROJECT_USER_TAG = CLUSTERNATOR_PREFIX + DELIM + 'project' + DELIM;
const PR_TAG = CLUSTERNATOR_PREFIX + DELIM + 'pr';
const SSH_PUBLIC_PATH = 'ssh-public';

const constants = Object.freeze({
  PROJECT_USER_TAG,
  DEFAULT_API_VERSION: '0.1',
  LOG_LEVELS: Object.freeze({
    0: 'error',
    1: 'warn',
    2: 'info',
    3: 'verbose',
    4: 'debug',
    5: 'silly'
  }),
  CLUSTERNATOR_PREFIX,
  CLUSTERNATOR_TAG,
  DEPLOYMENT_TAG,
  EXPIRES_TAG,
  PROJECT_TAG,
  PR_TAG,
  PROMISE_API_TIMEOUT: 5 * 60 * 1000, // five minutes
  SSH_PUBLIC_PATH
});

module.exports = constants;
