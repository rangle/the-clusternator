'use strict';

// We need this to build our post string
const path = require('path');
const http = require('https');

const HOST = '$HOST';
const CLUSTERNATOR = `the-clusternator.${HOST}`;
const PORT = 443;
const CONFIG_FILE = 'clusternator.json';

module.exports = main;

/**
 * @param {string} projectId
 * @param {string} key
 * @param {string} image
 * @returns {Promise}
 */
function main(projectId, key, image, sshKeys, path, deployment) {
  const pr = process.env.CIRCLE_PR_NUMBER || 0;
  const build = process.env.CIRCL_BUILD_NUM || 0;
  const SHARED_KEY = process.env.CLUSTERNATOR_SHARED_KEY;
  const repo = projectId;

  // Build the post string from an object
  const data = JSON.stringify({
    pr,
    deployment,
    build,
    repo,
    image,
    sshKeys,
    appDef: getAppDef(SHARED_KEY, HOST, repo, pr, image, deployment)
  });

  return post(data, key, path);
}


function die(err) {
  if (err instanceof Error) {
    throw err;
  }
  throw new Error('unexpected death error');
}

function getAppDefPath(deployment) {
  let config;
  try {
    config = require(path.join('..', CONFIG_FILE));
  } catch (err) {
    console.log('Error loading', CONFIG_FILE);
    console.log(err);
    die(err);
  }
  return path.join(
    __dirname, '..', config.deploymentsDir, deployment
  );
}

function requireAppDef(deployment) {
  const appDefPath = getAppDefPath(deployment);
  try {
    return require(appDefPath);
  } catch (err) {
    console.log('Error loading application definition', appDefPath);
    console.log(err);
    die(err);
  }
}

/**
 * @param {string} key
 * @param {string} host
 * @param {string} repo
 * @param {string} pr
 * @param {string} image
 * @param {string} deployment
 */
function getAppDef(key, host, repo, pr, image, deployment) {
  const appDef = requireAppDef(deployment);
  console.log('Loading Application Definition');
  appDef.tasks[0].containerDefinitions[0].environment.push({
    name: 'PASSPHRASE',
    value: key
  });
  if (deployment === 'pr') {
    const hostname = `${repo}-pr-${pr}.${host}`;
    appDef.tasks[0].containerDefinitions[0].hostname = hostname;
    appDef.tasks[0].containerDefinitions[0].environment.push({
      name: 'HOST',
      value: hostname
    });
  } else if (deployment === 'master') {
    const hostname = `${repo}.${host}`;
    appDef.tasks[0].containerDefinitions[0].hostname = hostname;
    appDef.tasks[0].containerDefinitions[0].environment.push({
      name: 'HOST',
      value: hostname
    });
  } else {
    const hostname = `${repo}-${deployment}.${host}`;
    appDef.tasks[0].containerDefinitions[0].hostname = hostname;
    appDef.tasks[0].containerDefinitions[0].environment.push({
      name: 'HOST',
      value: hostname
    });
  }
  appDef.tasks[0].containerDefinitions[0].image = image;
  return JSON.stringify(appDef);
}

function post(data, auth, path) {

  // An object of options to indicate where to post to
  const postOptions = {
    host: CLUSTERNATOR,
    port: PORT,
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
      'Authorization': 'Token ' + auth
    }
  };

  console.log('Posting To:', CLUSTERNATOR);
  return new Promise((resolve, reject) => {
    // Set up the request
    const postReq = http.request(postOptions, (res) => {
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        console.log('Response: ' + chunk);
        resolve();
      });
      res.on('error', reject);
    });

    // post the data
    postReq.write(data);
    postReq.end();
  });
}
