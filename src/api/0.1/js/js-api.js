'use strict';

const UTF8 = 'utf8';
const DOCKERFILE = 'Dockerfile';
const DOCKERFILE_NODE_LATEST = 'Dockerfile-node-14.04-4.2.3';
const DOCKERFILE_STATIC_LATEST = 'dockerfile-nginx-latest';
const SERVE_SH = 'serve.sh';
const DECRYPT_SH = 'decrypt.sh';
const DOCKER_BUILD_SH = 'docker-build.sh';
const NOTIFY_JS = 'notify.js';
const CIRCLEFILE = 'circle.yml';
const CLUSTERNATOR_DIR = /\$CLUSTERNATOR_DIR/g;
const CLUSTERNATOR_PASS = /\$CLUSTERNATOR_PASS/g;
const PRIVATE_CHECKSUM = '.private-checksum';
const DEFAULT_API = /\$DEFAULT_API/g;
const HOST = /\$HOST/g;

const Q = require('q');
const fs = require('fs');
const path = require('path');
const mkdirp = Q.nfbind(require('mkdirp'));

const cmn = require('../common');
const clusternatorJson = cmn.src('clusternator-json');
const Config = cmn.src('config');
const util = cmn.src('util');
const constants = cmn.src('constants');

const gpg = cmn.src('cli-wrappers', 'gpg');
const shaDir = cmn.src('cli-wrappers', 'generate-private-sha');
const git = cmn.src('cli-wrappers', 'git');
const docker = cmn.src('cli-wrappers', 'docker');

const appDefSkeleton = cmn.src('skeletons', 'app-def');

const cnProjectManager = cmn.src('clusternator', 'projectManager');
const awsProjectManager = cmn.src('aws', 'project-init');

const server = cmn.src('server', 'main');

const writeFile = Q.nbind(fs.writeFile, fs),
  readFile = Q.nbind(fs.readFile, fs),
  chmod = Q.nbind(fs.chmod, fs);


module.exports = {
  getProjectRootRejectIfClusternatorJsonExists,
  installExecutable,
  installGitHook,
  provisionProjectNetwork,
  listSSHAbleInstances,
  getProjectAPI,
  generateDeploymentFromName,
  getSkeletonFile,
  initializeDeployments,
  initializeScripts,
  initializeCircleCIFile,
  addPrivateToIgnore,
  initializeServeSh,
  privateChecksum,
  privateDiff,
  deploy,
  stop,
  startServer,
  initProject,
  makePrivate,
  readPrivate,
  dockerBuild,
  describeServices,
  listProjects,
  certUpload,
  certList,
  generatePass: git.generatePass
};

/**
 * @returns {Q.Promise<string>}
 */
function getProjectRootRejectIfClusternatorJsonExists() {
  return clusternatorJson
    .findProjectRoot()
    .then((root) => clusternatorJson
      .skipIfExists(root)
      .then(() => root ));
}

function initializeSharedKey() {
  return gpg.generatePass();
}

function provisionProjectNetwork(projectId, output) {
  return getProjectAPI()
    .then((pm) =>  pm
      .create(projectId)
      .then(() => util
        .info(output + ' Network Resources Checked'))
      .then(() => pm
        .initializeGithubWebhookToken(projectId))
      .then((token) => console.log('STORE THIS TOKEN ON GITHUB', token))
      .then(initializeSharedKey)
      .then((sharedKey) => console.log(`CLUSTERNATOR_SHARED_KEY ${sharedKey}`))
      .fail(Q.reject));
}

function installExecutable(destFilePath, fileContents, perms) {
  perms = perms || '700';
  return writeFile(destFilePath, fileContents).then(() => {
    return chmod(destFilePath, '700');
  });
}

function installGitHook(root, name, passphrase) {
  return getSkeletonFile('git-' + name)
    .then((contents) => {
      contents = contents.replace(CLUSTERNATOR_PASS, passphrase);
      return installExecutable(
        path.join(root, '.git', 'hooks', name), contents, 300);
    });
}


function getSkeletonPath() {
  return path.join(__dirname, '..', '..', '..', '..', 'src', 'skeletons');
}

/**
 * @param {string} skeleton
 * @return {Promise<string>}
 */
function getSkeletonFile(skeleton) {
  return readFile(path.join(getSkeletonPath(), skeleton) , UTF8);
}

/**
 * @param {string} ignoreFile
 * @param {string} privatePath
 * @returns {Q.Promise}
 */
function addPrivateToIgnore(ignoreFile, privatePath) {

  return clusternatorJson
    .readIgnoreFile(path.join(getSkeletonPath(), ignoreFile), true)
    .then((ignores) => ignores .concat(privatePath))
    .then((ignores) => clusternatorJson.addToIgnore(ignoreFile, ignores));
}




function writeDeployment(name, dDir, appDef) {
  return writeFile(path.join(dDir, name + '.json'), appDef);
}


function initClusternatorProject(config) {
  return cnProjectManager(config);
}

function getProjectAPI() {
  var config = Config();

  if (config.awsCredentials) {
    return awsProjectManager(config);
  }
  return initClusternatorProject(config);
}



function mapEc2ProjectDetails(instance) {
  var result = {
    type: 'type',
    identifier: '?',
    str: '',
    ip: '',
    state: ''
  }, inst, tags;
  if (!instance.Instances.length) {
    return result;
  }
  inst = instance.Instances[0];
  tags = inst.Tags;
  result.ip = inst.PublicIpAddress;
  result.state = inst.State.Name;

  tags.forEach((tag) => {
    if (tag.Key === constants.PR_TAG) {
      result.type = 'PR';
      result.identifier = tag.Value;
    }
    if (tag.Key === constants.DEPLOYMENT_TAG) {
      result.type = 'Deployment';
      result.identifier = tag.Value;
    }
  });

  result.str = `${result.type} ${result.identifier} ` +
    `(${result.ip}/${result.state})`;

  return result;
}

function listSSHAbleInstancesByProject(projectId) {
  return getProjectAPI()
    .then((pm) => pm
      .ec2
      .describeProject(projectId)
      .then((instances) => instances
        .map(mapEc2ProjectDetails)
      ));
}

function listSSHAbleInstances() {
  return clusternatorJson
    .get()
    .then((cJson) => listSSHAbleInstancesByProject(cJson.projectId));
}



function generateDeploymentFromName(name) {
  util.info('Generating deployment: ',  name);
  return clusternatorJson.get().then((config) => {
    var appDef = util.clone(appDefSkeleton);
    appDef.projectId = config.projectId;
    appDef = JSON.stringify(appDef, null, 2);
    return writeDeployment(name, config.deploymentsDir, appDef);
  });
}

/**
 * @param {string} clustDir
 * @param {string} tld
 * @returns {Q.promise}
 */
function initializeScripts(clustDir, tld) {
  return mkdirp(clustDir).then(() => {
    const decryptPath = path.join(clustDir, DECRYPT_SH),
      dockerBuildPath = path.join(clustDir, DOCKER_BUILD_SH),
      clusternatorPath = path.join(clustDir, NOTIFY_JS);

    return Q
      .allSettled([
        getSkeletonFile(DECRYPT_SH)
          .then((contents) => installExecutable(decryptPath, contents)),
        getSkeletonFile(DOCKER_BUILD_SH)
          .then((contents) => installExecutable(dockerBuildPath, contents)),
        getSkeletonFile(NOTIFY_JS)
          .then((contents) => contents
            .replace(HOST, tld)
            .replace(DEFAULT_API, constants.DEFAULT_API_VERSION))
          .then((contents) => writeFile(clusternatorPath, contents))]);
  });
}

/**
 * @param {string} depDir
 * @param {string} projectId
 * @param {string} dockerType
 * @returns {Q.Promise}
 */
function initializeDeployments(depDir, clustDir, projectId, dockerType) {
  return mkdirp(depDir).then(() => {
    var prAppDef = util.clone(appDefSkeleton);
    prAppDef.name = projectId;
    prAppDef = JSON.stringify(prAppDef, null, 2);

    return Q.allSettled([
      mkdirp(path.join(depDir, '..', constants.SSH_PUBLIC_PATH)),
      writeFile(path.join(depDir, 'pr.json'), prAppDef),
      writeFile(path.join(depDir, 'master.json'), prAppDef),
      initializeDockerFile(clustDir, dockerType)
    ]);
  });
}


function initializeDockerFile(clustDir, dockerType) {
  /** @todo do not overwrite existing Dockerfile */
  const template = dockerType === 'static' ?
    DOCKERFILE_STATIC_LATEST : DOCKERFILE_NODE_LATEST;
  return clusternatorJson
    .findProjectRoot()
    .then((root) => getSkeletonFile(template)
      .then((contents) => {
        contents = contents.replace(CLUSTERNATOR_DIR, clustDir);
        return writeFile(path.join(root, DOCKERFILE), contents);
      }) );
}

function initializeServeSh(root) {
  var sPath = path.join(root, SERVE_SH);
  return getSkeletonFile(SERVE_SH)
    .then((contents) => {
      return writeFile(sPath, contents);
    })
    .then(() => {
      return chmod(sPath, '755');
    });
}

function initializeCircleCIFile(root, clustDir) {
  return getSkeletonFile(CIRCLEFILE)
    .then((contents) => {
      contents = contents.replace(CLUSTERNATOR_DIR, clustDir);
      return writeFile(path.join(root, CIRCLEFILE), contents);
    });
}

function getPrivateChecksumPaths() {
  return Q.all([
      clusternatorJson.get(),
      clusternatorJson.findProjectRoot() ])
    .then((results) => {
      const privatePath = results[0].private,
        checksumPath = path.join(results[1], results[0].clusternatorDir,
          PRIVATE_CHECKSUM);
      return {
        priv: privatePath,
        checksum: checksumPath,
        clusternator: results[0].clusternatorDir,
        root: results[1]
      };
    });
}

function privateChecksum() {
  return getPrivateChecksumPaths()
    .then((paths) => {
      return mkdirp(paths.clusternator).then(() => paths);
    }).then((paths) => {
      process.chdir(paths.root);
      return paths;
    }).then((paths) =>shaDir
      .genSha(paths.priv)
      .then((sha) => writeFile(paths.checksum, sha)
        .then(() => util
          .info(`Generated shasum of ${paths.priv} => ${sha}`))))
    .done();
}

/**
 * @param {string} sha
 * @returns {Function}
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

function privateDiff() {
  return getPrivateChecksumPaths()
    .then((paths) => shaDir
      .genSha(paths.priv)
      .then((sha) => readFile(paths.checksum, UTF8)
        .then(getPrivateDiffFn(sha))
        .fail(() => {
          // read file errors are expected
          util.info(`Diff: no checksum to compare against`);
          process.exit(2);
        })))
    .fail((err) => {
      // unexpected error case
      util.error(err);
      process.exit(2);
    })
    .done();
}

/**
 * @param {string} name
 * @returns {Request|Promise.<T>|*}
 */
function deploy(name) {
  return clusternatorJson
    .get()
    .then((cJson) => {
      var dPath = path.join(cJson.deploymentsDir, name + '.json');
      return Q
        .all([
          getProjectAPI(),
          git.shaHead(),
          readFile(dPath, UTF8)
            .fail(getAppDefNotFound(dPath))])
        .then((results) => deploy_(
          results[0], cJson, results[2], name, results[1]))
        .fail((err) => {
          util.info('Clusternator: Error creating deployment: ' + err.message);
          util.info(err.stack);
        });
    });
}

function stop(name, sha) {
  return clusternatorJson
    .get()
    .then((cJson) => Q
      .all([
        getProjectAPI(),
        git.shaHead()])
      .then((results) => {
        sha = sha || results[1];
        util.info('Stopping Deployment...: ', cJson.projectId, ': ', name,
          ' sha: ', sha);
        return results[0].destroyDeployment(
          cJson.projectId,
          name,
          sha
        );
      }).fail((err) => {
        util.info('Clusternator: Error stopping deployment: ' + err.message);
        util.info(err.stack);
      })
    );
}


function startServer(config) {
  return server.startServer(config);
}

/**
 * @param {ProjectManager} pm
 * @param {Object} cJson
 * @param {string} appDefStr
 * @param {string} deployment
 * @param {string} sha
 * @returns {Request|Promise.<T>}
 * @private
 */
function deploy_(pm, cJson, appDefStr, deployment, sha) {
  util.info('Requirements met, creating deployment...');
  var appDef = util.safeParse(appDefStr);
  if (!appDef) {
    throw new Error('Deployment failed, error parsing appDef');
  }
  return pm.createDeployment(
    cJson.projectId,
    deployment,
    sha,
    appDef
  ).then((result) => {
    util.info('Deployment will be available at ', result);
  });
}

function getAppDefNotFound(dPath) {
  return (err) => {
    util.info(`Deployment AppDef Not Found In: ${dPath}: ${err.message}`);
    throw err;
  };
}

/**
 * @param {string} root
 * @param {{ deploymentsDir: string, clusternatorDir: string,
 projectId: string, backend: string, tld: string, circleCi: boolean }} options
 * @param skipNetwork
 * @returns {Request|Promise.<T>|*}
 */
function initProject(root, options, skipNetwork) {
  var output = 'Clusternator Initialized With Config: ' +
      clusternatorJson.fullPath(root),
    dDir = options.deploymentsDir,
    cDir = options.clusternatorDir,
    projectId = options.projectId,
    dockerType = options.backend;

  return Q
    .allSettled([
      initializeDeployments(dDir, cDir, projectId, dockerType),
      initializeScripts(cDir, options.tld),
      initializeOptionalDeployments(options, root)])
    .then(() => {
      if (skipNetwork) {
        util.info(output + ' Network Resources *NOT* Checked');
        return;
      }

      return provisionProjectNetwork(projectId, output);
    });
}

/**
 * @param {{ deploymentsDir: string, clusternatorDir: string,
 projectId: string, backend: string, tld: string, circleCi: boolean }} options
 * @param {string} projectRoot
 * @returns {Request|Promise.<T>|*}
 */
function initializeOptionalDeployments(options, projectRoot) {
  let promises = [];

  if (options.circleCI) {
    promises.push(
      initializeCircleCIFile(projectRoot, options.clusternatorDir));
  }
  if (options.backend === 'node') {
    promises.push(initializeServeSh(
      path.join(projectRoot, options.clusternatorDir)));
  }
  return Q.allSettled(promises);
}


function dockerBuild(name, passphrase) {
  return makePrivate(passphrase).then(() => {
    return clusternatorJson
      .findProjectRoot()
      .then((root) => {
        var output, outputError;
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
        return readPrivate(passphrase);
      })
      .then(() => {
        util.info('Built Docker Image: ', name);
      })
      .fail((err) => {
        util.warn('Docker failed to build: ', err.message);
        return readPrivate(passphrase);
      });
  });
}

function makePrivate(passphrase) {
  return clusternatorJson
    .makePrivate(passphrase)
    .then(() => {
      util.info('Clusternator: Private files/directories encrypted');
    });
}

function readPrivate(passphrase) {
  return clusternatorJson.readPrivate(passphrase).then(() => {
    util.info('Clusternator: Private files/directories un-encrypted');
  });
}

function listProjects() {
  return getProjectAPI()
    .then((pm) => pm
      .listProjects());
}

function describeServices() {
  return getProjectAPI()
    .then((pm) => clusternatorJson
      .get()
      .then((config) => pm
        .describeProject(config.projectId)));
}


/**
 * @param {string} privateKey
 * @param {string} certificate
 * @param {string=} chain
 * @return {Q.Promise}
 */
function loadCertificateFiles(privateKey, certificate, chain) {
  var filePromises = [
    readFile(privateKey, UTF8),
    readFile(certificate, UTF8)
  ];
  if (chain) {
    filePromises.push(readFile(chain, UTF8));
  }
  return Q
    .all(filePromises)
    .then((results) => {
      return {
        privateKey: results[0],
        certificate: results[1],
        chain: results[2] || ''
      };
    });
}

/**
 * @param {string} privateKey
 * @param {string} certificate
 * @param {string} certId
 * @param {string=} chain
 * @return {Q.Promise}
 */
function certUpload(privateKey, certificate, certId, chain) {
  return loadCertificateFiles(privateKey, certificate, chain)
  .then((certs) => getProjectAPI()
    .then((pm) => pm.iam
      .uploadServerCertificate(
        certs.certificate, certs.privateKey, certs.chain, certId)));
}

function certList() {
  return getProjectAPI()
    .then((pm) => pm.iam
      .listServerCertificates());
}
