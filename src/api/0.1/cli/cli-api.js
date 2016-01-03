'use strict';

const  path = require('path');

const cmn = require('../common');
const util = cmn.src('util');
const Config = cmn.src('config');
const cn = require('../js/js-api');

const stdioI = require('./stdio-inheritors');
const project = require('./project-questions');

const legacy = require('./legacy-yargs');

module.exports = (yargs) => {

  util.cliLogger(yargs);

  yargs.usage('Usage: $0 <command> [opts]');


  yargs
    .completion('completion', 'Generate bash completions')
    .command('bootstrap', 'Bootstraps an AWS environment so that projects ' +
      'can be launched into it', () => util.info('Bootstrap environment'))
    .command('init', 'Initializes a `.clusternator` file in the project ' +
      'repo, and provisions AWS networking resources.  Requires AWS ' +
      'credentials', (y) => {
      y.demand('o')
        .alias('o', 'offline')
        .default('o', false)
        .describe('o', 'offline only, makes "clusternator.json" but does ' +
          '*not* check the cloud infrastructure');

      project.init(y.argv.o).done();
    })
    .command('config', 'Configure the local clusternator user',
      () => Config.interactiveUser().done())
    .command('serve', 'Start a clusternator server. (typically prefer npm ' +
      'start, or serve.sh', () =>  {
      const config = Config();
      return cn.startServer(config);
    })

    .command('list-projects', 'List projects with clusternator resources',
      (y) => cn
        .listProjects()
        .then((projectNames) => projectNames
          .forEach(console.log))
        .done())
    .command('describe-services', 'Describe project services', (y) => cn
      .describeServices()
      .then((desc) => util
        .info(JSON.stringify(desc, null, 2)))
      .done())
    .command('build', 'Local Docker Build', (y) => {
      var id = (+Date.now()).toString(16),
        argv = demandPassphrase(y)
          .demand('i')
          .alias('i', 'image')
          .describe('i', 'Name of the docker image to create')
          .default('i', id)
          .argv;

      util.info('Building Docker Image: ', argv.i);

      return cn
        .dockerBuild(argv.i, argv.p).fail((err) => {
          util.error('Error building local Docker image: ', err);
        }).done();
    })
    .command('deploy', 'Makes a deployment', (y) => {
      y.demand('d').
      alias('d', 'deployment-name').
      describe('d', 'Requires a deployment name');

      cn.deploy(y.argv.d).done();
    })
    .command('stop', 'Stops a deployment, and cleans up', (y) => {
      y.demand('d').
      alias('d', 'deployment-name').
      describe('d', 'Requires a deployment name').
      alias('s', 'SHA (git hash)').
      default('s', '', 'HEAD').
      describe('s', 'Requires a SHA');

      cn.stop(y.argv.d, y.argv.s).done();
    })

    .command('generate-deployment', 'Generates a deployment config', (y) => {
      y.demand('d').
      alias('d', 'deployment-name').
      describe('d', 'Requires a deployment name');

      cn.generateDeploymentFromName(y.argv.d).done();
    })
    .command('generate-ssh-key', 'Adds a new SSH Key', (y) => {
      y.demand('n').
      alias('n', 'name').
      describe('n', 'Creates a new SSH key with the provided name.  The ' +
        'keypair are stored in ~/.ssh, and the public key is installed into ' +
        'the project');

      stdioI.newSshKey(y.argv.n).done();
    })
    .command('generate-pass', 'Generate a secure passphrase', () => cn
      .generatePass()
      .then((passphrase) => util
        .info('Keep this passphrase secure: ' + passphrase))
      .fail((err) => util
        .info('Error generating passphrase: ' + err.message)))

    .command('make-private', 'Encrypts private assets (defined in ' +
      'clusternator.json)', (y) => {
      demandPassphrase(y);

      cn.makePrivate(y.argv.p);

    })
    .command('read-private', 'Decrypts private assets (defined in ' +
      'clusternator.json)', (y) => {

      demandPassphrase(y);

      cn.readPrivate(y.argv.p).done();
    })

    .command('cert-upload', 'Upload a new SSL certificate', (y) => {
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

      cn.certUpload(y.argv.p, y.argv.c, y.argv.n, y.argv.h)
        .fail(console.log)
        .done();
    })
    .command('cert-delete', 'Destroy an uploaded SSL certificate')
    .command('cert-list', 'List uploaded SSL certificates', () => cn
      .certList()
      .then(console.log))

    .command('private-checksum', 'Calculates the hash of .private, and ' +
      'writes it to .clusternator/.private-checksum', cn.privateChecksum)
    .command('private-diff', 'Exits 0 if there is no difference between ' +
      '.clusternator/.private-checksum and a fresh checksum Exits 1 on ' +
      'mismatch, and exits 2 if private-checksum is not found',
      cn.privateDiff)

    .command('log', 'Application logs from a user selected server',
      stdioI.logApp)
    .command('log-ecs', 'ECS logs from a user selected server',
      stdioI.logEcs)
    .command('ssh', 'SSH to a selected server', stdioI.sshShell);

  legacy(yargs);
};

function demandPassphrase(y){
  return y.demand('p').
  alias('p', 'passphrase').
  describe('p', 'Requires a passphrase to encrypt private directory');
}

