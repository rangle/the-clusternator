'use strict';

/**
 * This is the primary interface to the {@link module:clusternatorCli}.
 *
 * This module is responsible for parsing arguments and handling errors only.
 * Any actual logic is delegated to internal modules.
 *
 * @module api/'0.1'/cli
 */
const API = '0.1';

const R = require('ramda');
const path = require('path');

const cmn = require('../common');
const util = cmn.src('util');
const Config = cmn.src('config');

const cn = require('../js/js-api');
const deployments = require('./deployments');
const stdioI = require('./stdio-inheritors');
const project = require('./project');
const user = require('./user');
const projectDb = require('./project-db');
const aws = require('./cloud-service');
const authorities = require('./cli-authorities');

const privateFs = require('../project-fs/private');
const dockerFs = require('../project-fs/docker');
const deploymentsFs = require('../project-fs/deployments');
const gitHooks = require('../project-fs/git-hooks');

const pkg = require('../../../../package.json');

module.exports = {
  configure: function(yargs) {
    const applyCommands = R.pipe.apply(null, R.values(this.commands));
    applyCommands(yargs);
    util.cliLogger(yargs);

    yargs
      .usage('Usage: $0 <command> [opts]')
      .completion('completion', 'Generate bash completions')
      .version(() => `Package: ${pkg.version} API: ${API}`)
      .help('h')
      .alias('h', 'help')
      .argv;
  },

  // Exposed for unit testing.
  commands: {
    bootstrap,
    init,
    generateDeployment,
    generateSshKey,
    generatePass,
    gitHookInstall,
    gitHookRemove,
    config,
    projectCommands,
    createUser,
    login,
    passwd,
    certUpload,
    certDelete,
    certList,
    serve,
    listAuthorities,
    listProjects,
    build,
    deploy,
    stop,
    update,
    makePrivate,
    readPrivate,
    privateChecksum,
    privateDiff,
    log,
    logEcs,
    ssh
  }
};

function init(yargs) {
  return yargs.command(
    'init',
    'Initializes a `.clusternator` file in the project ' +
      'repo, and provisions AWS networking resources.  Requires AWS ' +
      'credentials',
    (y) => {
      y.demand('o')
        .alias('o', 'offline')
        .default('o', false)
        .describe('o', 'offline only, makes "clusternator.json" but does ' +
          '*not* check the cloud infrastructure');

      project.init(y.argv.o)
        .fail(util.cliErr('Failed to initialize project.'))
        .done();
    });
}

function projectCommands(yargs) {
  return yargs.command(
    'project',
    'Project management commands (try clusternator project --help)',
    (y) => {
      const applySubCommands = R.pipe(
        project_createData,
        project_gitHubKey,
        project_sharedKey,
        project_resetAuthToken,
        project_resetGitHubKey,
        project_resetSharedKey,
        project_changeSlackChannel);

      const argv = applySubCommands(y)
        .usage('Usage: $0 project <command> [opts]')
        .help('h')
        .alias('h', 'help')
        .argv;
    });
}

function project_createData(yargs) {
  return yargs.command(
    'create-data',
    'create project db entry',
    () => projectDb.createData()
      .fail(util.cliErr('Failed to create project data.'))
      .done());
}

function project_gitHubKey(yargs) {
  return yargs.command(
    'git-hub-key',
    'Display GitHub key (warning: returns secret GitHub key)',
    () => projectDb.getGitHub()
      .fail(util.cliErr('Failed to locate github key.'))
      .done());
}

function project_sharedKey(yargs) {
  return yargs.command(
    'shared-key',
    'Display shared key (warning: returns secret shared key)',
    () => projectDb.getShared()
      .fail(util.cliErr('Failed to locate shared key.'))
      .done());
}

function project_resetAuthToken(yargs) {
  return yargs.command(
    'reset-auth-token',
    'Reset authentication token',
    () => projectDb.resetAuth()
      .fail(util.cliErr('Failed to reset auth token.'))
      .done());
}

function project_resetGitHubKey(yargs) {
  return yargs.command(
    'reset-git-hub-key',
    'Reset GitHub key',
    () => projectDb.resetGitHub()
      .fail(util.cliErr('Failed to reset github key.'))
      .done());
}

function project_resetSharedKey(yargs) {
  return yargs.command('reset-shared-key', 'Reset shared key',
    () => projectDb.resetShared()
      .fail(util.cliErr('Failed to reset shared key.'))
      .done());
}

function project_changeSlackChannel(yargs) {
  return yargs.command(
    'change-slack-channel',
    'Change slack channel',
    (y) => {
      y.demand('c')
        .alias('c', 'channel')
        .describe('c', 'Slack channel name');

      projectDb.changeSlackChannel(y.argv.c)
        .fail(util.cliErr('Failed to change slack channel.'))
        .done();
    });

}

function config(yargs) {
  return yargs.command('config', 'Configure the local clusternator user',
    () => Config.interactiveUser()
      .fail(util.cliErr('Failed to configure local user.'))
      .done());
}

function createUser(yargs) {
  return yargs.command(
    'create-user',
    'Create a user on the clusternator server',
    (y) => {
      y.demand('n')
        .alias('n', 'username')
        .describe('n', 'Username for the account')
        .default('n', '')
        .demand('p')
        .alias('p', 'password')
        .describe('p', 'password for the user')
        .default('p', '')
        .demand('c')
        .alias('c', 'confirm-password')
        .describe('c', 'confirm user password')
        .default('c', '')
        .demand('a')
        .alias('a', 'authority')
        .default('a', 2)
        .describe('a', 'authority of the user {number} lower numbers have ' +
          'more authority than higher number');
      user.createUser(y.argv.n, y.argv.p, y.argv.c, y.argv.a)
        .fail(util.cliErr('Error creating user.'))
        .done();
    });
}

function login(yargs) {
  return yargs.command('login', 'Login to the clusternator server',
  (y) =>  {
    y.demand('p')
      .alias('p', 'password')
      .describe('p', 'your password (be careful with shell entry like ' +
        'this)')
      .default('p', '')
      .demand('u')
      .alias('u', 'user-name')
      .describe('u', 'user name to login with, (defaults to local config ' +
        'if available)')
      .default('u', '');

    return user.login(y.argv.u, y.argv.p)
      .fail(util.cliErr('Error logging in.'))
      .done();
  });
}

function passwd(yargs) {
  return yargs.command('passwd', 'Change your clusternator server password',
  (y) => {
    y.demand('p')
      .alias('p', 'password')
      .describe('your password (be careful with shell entry like this)')
      .default('p', '')
      .demand('n')
      .alias('n', 'new-password')
      .describe('n', 'your NEW password (be careful with shell entry ' +
        'like this)')
      .default('n', '')
      .demand('c')
      .alias('c', 'confirm-password')
      .describe('c', 'confirm your NEW password')
      .default('c', '')
      .demand('u')
      .alias('u', 'user-name')
      .describe('u', 'user name to login with')
      .default('u', '');

    return user.changePassword(y.argv.u, y.argv.p, y.argv.n, y.argv.c)
      .fail(util.cliErr('Error changing password.'))
      .done();
  });
}

// Promise?
function serve(yargs) {
  return yargs.command(
    'serve',
    'Start a clusternator server (i.e. \'npm start\' or \'serve.sh\'',
    () =>  {
      const config = Config();
      return cn.startServer(config);
    });
}

function listAuthorities(yargs) {
  return yargs.command(
    'list-authorities',
    'List your Clusternator server\'s authorities',
    () => authorities.list()
      .fail(util.cliErr('Error listing authorities'))
      .done());
}

function listProjects(yargs) {
  return yargs.command(
    'list-projects',
    'List projects with clusternator resources',
    (y) => aws.listProjects()
      .then((projectNames) => projectNames.forEach(console.log))
      .fail(util.cliErr('Error listing projects.'))
      .done());
}

function build(yargs) {
  return yargs.command(
    'build',
    'Local Docker Build',
    (y) => {
      const id = (+Date.now()).toString(16);
      const argv = demandPassphrase(y)
        .demand('i')
        .alias('i', 'image')
        .describe('i', 'Name of the docker image to create')
        .default('i', id)
        .argv;

      util.info('Building Docker Image: ', argv.i);

      return dockerFs.build(argv.i, argv.p)
        .fail(util.cliErr('Error building local Docker image'))
        .done();
    });
}

function deploy(yargs) {
  return yargs.command(
    'deploy',
    'Makes a deployment',
    (y) => {
      y.demand('d').
      alias('d', 'deployment-name').
      describe('d', 'Requires a deployment name');

      y.count('force')
       .alias('f', 'force')
       .describe('f', 'Forces teardown if deployment exists.');

      y.count('update')
       .alias('u', 'update')
       .describe('u', 'Forces teardown if deployment exists.');

      deployments.deploy(y.argv.d, y.argv.f, y.argv.u)
        .fail(util.cliErr('Error deploying.'))
        .done();
    });
}

function stop(yargs) {
  return yargs.command(
    'stop',
    'Stops a deployment, and cleans up',
    (y) => {
      y.demand('d').
      alias('d', 'deployment-name').
      describe('d', 'Requires a deployment name');

      deployments.stop(y.argv.d)
        .fail(util.cliErr('Error stopping deployment.'))
        .done();
    });
}

function update(yargs) {
  return yargs.command(
    'update',
    'Updates a deployment in place',
    (y) => {
      y.demand('d').
      alias('d', 'deployment-name').
      describe('d', 'Requires a deployment name');

      deployments.update(y.argv.d)
        .fail(util.cliErr('Error updating deployment.'))
        .done();
    });
}

function generateDeployment(yargs) {
  return yargs.command(
    'generate-deployment',
    'Generates a deployment config',
    (y) => {
      y.demand('d').
      alias('d', 'deployment-name').
      describe('d', 'Requires a deployment name');

    deploymentsFs.generateDeploymentFromName(y.argv.d)
      .fail(util.cliErr('Error generating config.'))
      .done();
  });
}

function generateSshKey(yargs) {
  return yargs.command('generate-ssh-key', 'Adds a new SSH Key', (y) => {
    y.demand('n').
    alias('n', 'name').
    describe('n', 'Creates a new SSH key with the provided name.  The ' +
      'keypair are stored in ~/.ssh, and the public key is installed into ' +
      'the project');

    stdioI.newSshKey(y.argv.n)
      .fail(util.cliErr('Error generating SSH key.'))
      .done();
  });
}

function generatePass(yargs) {
  return yargs.command(
    'generate-pass',
    'Generate a secure passphrase',
    () => cn.generatePass()
      .then((passphrase) => util
        .info('Keep this passphrase secure: ' + passphrase))
      .fail(util.cliErr('Error generating passphase.')));
}

function gitHookInstall(yargs) {
  return yargs.command(
    'git-hook-install',
    'Install auto-encrypt/decrypt git hooks',
    () => gitHooks.install()
      .done());
}

function gitHookRemove(yargs) {
  return yargs.command(
    'git-hook-remove',
    'Remove auto-encrypt/decrypt git hooks',
    () => gitHooks.remove()
      .done());
}

function makePrivate(yargs) {
  return yargs.command(
    'make-private',
    'Encrypts private assets (defined in clusternator.json)',
    (y) => {
      demandPassphrase(y);
      return privateFs.makePrivate(y.argv.p)
        .fail(util.cliErr(
          'Failed to encrypt private', {
            ENOENT: { msg: 'project has no private files.', code: 1 }
          }))
        .done();
    });
}

function readPrivate(yargs) {
  return yargs.command(
    'read-private',
    'Decrypts private assets (defined in clusternator.json)',
    (y) => {
      demandPassphrase(y);
      return privateFs.readPrivate(y.argv.p)
        .fail(util.cliErr(
          'Failed to read private', {
            ENOENT: { msg: 'cannot find clusternator.tar.gz.asc', code: 1 }
          }))
        .done();
    });
}

function certUpload(yargs) {
  return yargs.command('cert-upload', 'Upload a new SSL certificate', (y) => {
    y.demand('n')
      .alias('n', 'name')
      .describe('n', 'Unique Name to give the certificate')
      .demand('p')
      .alias('p', 'private-key')
      .describe('p', 'Path to private key')
      .demand('c')
      .alias('c', 'certificate')
      .describe('c', 'Path to signed certificate')
      .demand('h')
      .alias('h', 'chain')
      .describe('h', 'Path to certificate chain')
      .default('h', '');

    aws.certUpload(y.argv.p, y.argv.c, y.argv.n, y.argv.h)
      .fail(util.cliErr('Error uploading cert.'))
      .done();
  });
}

function certList(yargs) {
  return yargs.command(
    'cert-list',
    'List uploaded SSL certificates',
    () => cn.certList()
      .fail(util.cliErr('Error listing certs.'))
      .done());
}

function privateChecksum(yargs) {
  return yargs.command(
    'private-checksum',
    'Calculates the hash of .private, and ' +
      'writes it to .clusternator/.private-checksum',
    () => privateFs.checksum()
      .fail(util.cliErr('Error computing private checksum.'))
      .done());
}

function privateDiff(yargs) {
  return yargs.command(
    'private-diff',
    'Exits 0 if there is no difference between ' +
      '.clusternator/.private-checksum and a fresh checksum Exits 1 on ' +
      'mismatch, and exits 2 if private-checksum is not found',
    () => privateFs.diff()
    .fail(util.cliErr('Error computing private checksum.'))
      .done());
}

function log(yargs) {
  return yargs.command(
    'log',
    'Application logs from a user selected server',
    () => stdioI.logApp()
      .fail(util.cliErr('Error displaying logs.'))
      .done());
}

function logEcs(yargs) {
  return yargs.command(
    'log-ecs',
    'ECS logs from a user selected server',
    () => stdioI.logEcs()
      .fail(util.cliErr('Error displaying ECS logs.'))
      .done());
}

function ssh(yargs) {
  return yargs.command(
    'ssh',
    'SSH to a selected server',
    () => stdioI.sshShell()
      .fail(util.cliErr('Error connecting with SSH.'))
      .done());
}

// TODO
function bootstrap(yargs) {
  return yargs.command(
    'bootstrap',
    'Bootstraps an AWS environment so that projects can be launched into it',
    () => util.info('TODO: Bootstrap environment.'));
}

// TODO
function certDelete(yargs) {
  return yargs.command(
    'cert-delete',
    'Destroy an uploaded SSL certificate',
    () => util.info('TODO: Destroy cert.'));
}

function demandPassphrase(y) {
  return y.demand('p')
    .alias('p', 'passphrase')
    .describe('p', 'Requires a passphrase to encrypt private directory');
}
