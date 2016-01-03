'use strict';

const  R = require('ramda'),
  Q = require('q');

/** this is not a constant for unit testing purposes */
var spawn = require('child_process').spawn;

const util = require('../util');

module.exports = {
  output,
  quiet,
  stream,
  inherit,
  stdin
};

/**
 * @param {string} command
 * @param {string} args
 * @returns {string}
 */
function commandStr(command, args) {
  return `${command} ${args.join(' ')}`;
}

/**
 * @param {string} command
 * @param {string} args
 * @param {string|number} code
 * @returns {string}
 */
function successString(command, args, code) {
  return `${commandStr(command, args)}   Process Exited: ${code}`;
}

/**
 * @param {string} command
 * @param {string} args
 * @param {string|number} code
 * @param {string=} stderr
 * @returns {string}
 */
function failString(command, args, code, stderr) {
  stderr = stderr || '';
  return `${commandStr(command, args)} terminated with exit code: ${code} ` +
    stderr;
}

/**
 * Resolves stdout, rejects with stderr, also streams
 * @param {string} command
 * @param {string[]=} args
 * @param {Object=} opts
 * @returns {Q.Promise<string>}
 */
function output(command, args, opts) {
  args = args || [];
  const options = R.merge({}, opts),
    d = Q.defer(),
    child = spawn(command, args, options);

  var stdout = '', stderr = '';

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  child.stdout.on('data', (data) => {
    d.notify({ stdout: data });
    stdout += data;
  });

  child.stderr.on('data', (data) => {
    d.notify({ stderr: data });
    stderr += data;
  });

  child.on('close', (code) => {
    util.verbose(successString(command, args, code));
    if (+code) {
      d.reject(new Error(failString(command, args, code, stderr)));
    } else {
      d.resolve(stdout.trim());
    }
  });

  child.stdin.end();

  return d.promise;
}

/**
 * Does not resolve stdout, but streams, and resolves stderr
 * @param {string} command
 * @param {string[]=} args
 * @param {Object=} opts
 * @returns {Q.Promise}
 */
function quiet(command, args, opts) {
  args = args || [];
  const options = R.merge({}, opts),
    d = Q.defer(),
    child = spawn(command, args, options);
  var stderr = '';

  child.stderr.setEncoding('utf8');

  child.stdout.on('data', (data) => {
    d.notify({ stdout: data });
  });

  child.stderr.on('data', (data) => {
    d.notify({ stderr: data });
    stderr += data;
  });

  child.on('close', (code) => {
    util.verbose(successString(command, args, code));
    if (+code) {
      d.reject(
        new Error(failString(command, args, code, stderr)));
    } else {
      d.resolve();
    }
  });

  child.stdin.end();

  return d.promise;
}

/**
 * Only streams stdout/stderr, no output on resolve/reject
 * @param {string} command
 * @param {string[]=} args
 * @param {Object=} opts
 * @returns {Q.Promise}
 */
function stream(command, args, opts) {
  args = args || [];
  const options = R.merge({}, opts),
    d = Q.defer(),
    child = spawn(command, args, options);

  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');

  child.stdout.on('data', (data) => {
    d.notify({ data: data });
  });

  child.stderr.on('data', (data) => {
    d.notify({ error: data });
  });

  child.on('close', (code) => {
    util.verbose(successString(command, args, code));
    if (+code) {
      d.reject(new Error(failString(command, args, code)));
    } else {
      d.resolve();
    }
  });

  child.stdin.end();

  return d.promise;
}

/**
 * Stdio inherits, meaning that the given command takes over stdio
 * @param {string} command
 * @param {string[]=} args
 * @param {Object=} opts
 * @returns {Q.Promise}
 */
function inherit(command, args, opts) {
  args = args || [];
  const options = R.merge({
      stdio: 'inherit'
    }, opts),
    d = Q.defer(),
    child = spawn(command, args, options);

  child.on('close', (code) => {
    util.verbose(successString(command, args, code));
    if (+code) {
      d.reject(new Error(failString(command, args, code)));
    } else {
      d.resolve();
    }
  });

  return d.promise;
}

/**
 * like output, but puts stdin in as stdin
 * @param {string} stdin
 * @param {string} command
 * @param {string[]=} args
 * @param {Object=} opts
 * @returns {Q.Promise<string>}
 */
function stdin(stdin, command, args, opts) {
  stdin = stdin || '';
  args = args || [];
  const options = R.merge({}, opts),
    d = Q.defer(),
    child = spawn(command, args, options);

  var stderr = '',
    stdout = '';

  child.stdout.on('data', (data) => {
    d.notify({ stdout: data });
    stdout += data;
  });

  child.stderr.on('data', (data) => {
    d.notify({ stderr: data });
    stderr += data;
  });

  child.on('close', (code) => {
    if (+code) {
      d.reject(failString(command, args, code, stderr));
    } else {
      d.resolve(stdout);
    }
  });

  child.stdin.write(stdin);
  child.stdin.end();

  return d.promise;
}
