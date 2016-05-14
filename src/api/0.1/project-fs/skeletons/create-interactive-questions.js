'use strict';
const skeleton = require('./clusternator-json-skeleton');
const cmn = require('../../common');
const util = cmn.src('util');

function truthy(value) {
  return value ? true : false;
}

function filterNumber(n) {
  return +n;
}

function validatePort(a) {
  return +a > 0 && +a < 65535;
}

function validateEmail(str) {
  return str.split('@').length === 2;
}


function userInit(defaults) {
  return [
    {
      type: 'input',
      name: 'name',
      message: 'Your Name',
      default: defaults.name || 'Mysterious Stranger',
      validate: truthy
    },
    {
      type: 'input',
      name: 'email',
      message: 'Email address',
      default: defaults.email || '',
      validate: validateEmail
    },
    {
      type: 'input',
      name: 'tld',
      message: 'Top Level Domain (TLD) Projects Will Be Served From',
      default: (ans) => defaults.tld || ans.email.split('@')[1],
      validate: truthy
    },
    {
      type: 'input',
      name: 'host',
      message: 'Clusternator Server Address',
      default: (ans) => defaults.host || `the-clusternator.${ans.tld}`,
      validate: truthy
    },
    {
      type: 'input',
      name: 'username',
      message: 'Clusternator User Name',
      default: (ans) => defaults.username || ans.name
        .split(' ')[0].toLowerCase(),
      validate: truthy
    }
  ];
}

function projectPorts(defaults) {
  defaults = defaults || {};

  return [
    {
      type: 'input',
      name: 'portExternal',
      message: 'Please specify an external (public) port',
      default: defaults.portExternal || '',
      filter: filterNumber,
      validate: validatePort
    },
    {
      type: 'input',
      name: 'portInternal',
      message: 'Please specify an internal (container/docker) port',
      default: defaults.portInternal || '',
      filter: filterNumber,
      validate: validatePort
    },
    {
      type: 'list',
      name: 'protocol',
      message: 'Please specify a protocol',
      choices: ['tcp', 'udp', 'all'],
      filter: (a) => a === 'all' ? -1 : a,
      default: 'tcp'
    },
    {
      type: 'confirm',
      name: 'moar',
      message: 'Add more port mappings?',
      default: false
    }
  ];
}

/**
 * @param {Object} defaults
 * @returns {Array}
 */
function projectInit(defaults) {
  defaults = defaults || {};

  if (!defaults.deploymentsDir) {
    defaults.deploymentsDir = util.clone(skeleton.deploymentsDir);
  }

  if (!defaults.tld) {
    defaults.tld = 'example.com';
  }

  if (!defaults.clusternatorDir) {
    defaults.clusternatorDir = util.clone(skeleton.clusternatorDir);
  }

  if (!defaults.private) {
    defaults.private = util.clone(skeleton.private);
  }

  function hasPassphrase(response) {
    return response.passphrase;
  }

  function hasBackend(response) {
    return response.backend === 'node' ? true : false;
  }

  return [
    {
      type: 'input',
      name: 'projectId',
      message: 'Project ID',
      default: defaults.name || '',
      validate: truthy
    },
    {
      type: 'input',
      name: 'gitHubOwner',
      message: 'GitHub username of "master"/main/central repo',
      validate: truthy
    },
    {
      type: 'input',
      name: 'clusternatorDir',
      message: 'Where should clusternator keep its files?',
      default: defaults.clusternatorDir,
      validate: truthy
    },
    {
      type: 'input',
      name: 'private',
      message: 'Where should clusternator keep your project\'s private files?',
      default: '.private'
    },
    {
      type: 'input',
      name: 'tld',
      message: 'What Top Level Domain (TLD) Will This Be Served From?',
      default: defaults.tld,
      validate: truthy
    },
    {
      type: 'list',
      name: 'backend',
      choices: [
        'static',
        'node (long-term-support)',
        'node (stable)',
        'node (current)'
      ],
      message: 'Choose a backend'
    },
    {
      type: 'input',
      name: 'deploymentsDir',
      message: 'Where will your appDefs/deployment files live?',
      default: defaults.deploymentsDir,
      validate: truthy
    },
    {
      type: 'confirm',
      name: 'gitHooks',
      message: 'Would you like git hooks installed that will encrypt/decrypt ' +
      'your .private files before/after commit, and after pulls?',
      default: true
    },
    {
      type: 'confirm',
      name: 'circleCI',
      message: 'Will you be using CircleCI?',
      default: true
    }
  ];
}

module.exports = {
  projectInit,
  userInit,
  projectPorts
};
