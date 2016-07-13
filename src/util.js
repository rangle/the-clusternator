'use strict';
/**
 * Utility functions global to The Clusternator
 * @module util
 */

const WAIT_DEFAULT_INTERVAL = 10000;

const Q = require('q');
const inquirer = require('inquirer');
const Winston = require('winston');
const constants = require('./constants');

let winston;

initWinston();

module.exports = {
  errLog: errLog,
  plog: plog,
  isFunction,
  quote: quote,
  getCidrPrefixFromIPString,
  waitFor,
  makePromiseApi,
  makeRetryPromiseFunction,
  clone,
  info,
  debug,
  validSlackChannel,
  verbose,
  warn,
  error,
  winston,
  inquirerPrompt,
  cliLogger,
  safeParse,
  isObject,
  deepFreeze,
  partial,
  cliErr
};

/**
 * @param {*} i
 * @returns {boolean}
 */
function isObject(i) {
  return i && (typeof i === 'object');
}

/**
 *  Starts up the winston logger for STDIO
 */
function initWinston() {
  winston = new (Winston.Logger)({
    transports: [
      new (Winston.transports.Console)() // TODO fix minimum log level
    ]
  });
}

/**
 * logs an info message(s) through winston (takes any args)
 */
function info() {
  winston.info.apply(winston, arguments);
}

/**
 * logs a debug message(s) through winston (takes any args)
 */
function debug() {
  const args = Array.prototype.slice.call(arguments, 0);
  args.unshift(' [DEBUG] ');
  if (process.env.NODE_ENV === 'debug') {
    winston.info.apply(winston, args);
  }
}

/**
 * logs a verbose message(s) through winston (takes any args)
 */
function verbose() {
  winston.verbose.apply(winston, arguments);
}

/**
 * logs a warning message(s) through winston (takes any args)
 */
function warn() {
  winston.verbose.apply(winston, arguments);
}

/**
 * logs an error message(s) through winston (takes any args)
 */
function error() {
  winston.error.apply(winston, arguments);
}

/**
 * Logs an info error labelled as error, and returns a Promise
 * @param {*} x
 * @returns {Promise}
 */
function errLog(x) {
  winston.info('ERROR', x);
  return Q.reject(new Error(x));
}

/**
 * @deprecated
 * @returns {*}
 */
function plog() {
  winston.info.apply(null, arguments);
  return arguments[0];
}

/**
  Double quote something
  @param {string} str
  @return {string} (double) quoted version
*/
function quote(str) {
  return '"' + str + '"';
}

/**
 * @param {string} channel
 * @returns {boolean}
 */
function validSlackChannel(channel) {
  const expression = /^[a-z0-9-_]{1,21}$/;
  return expression.test(channel);
}

/**
  @param {string} ip something like: '1.2.3.0/24'
  @return {string} first two classes, like: '1.2'
*/
function getCidrPrefixFromIPString(ip) {
  const classes = ip.split('.');
  return classes[0] + '.' + classes[1];
}

/**
  Wait function for polling something.

  Provide a function a that uses a promise to check something asynchronously.
  This "asyncPredicateFunction" should resolve when it's "ready" to proceed,
  and reject if it is not ready.

  @param {function(...):Promise} asyncPredicateFunction should resolve when its
    condition is eventually satisfied, and reject otherwise
  @param {number} interval ms to retry asyncPredicateFunction (defaults to
    10000)
  @param {number=} max maximum number of retries (default 0 for infinity)
  @param {string=} label label for debugging
  @return {Promise}
*/
function waitFor(asyncPredicateFunction, interval, max, label) {
  max = Math.abs(+max) || 0;
  interval = Math.abs(+interval) || WAIT_DEFAULT_INTERVAL;

  const defer = Q.defer();
  let count = 0;

  function poll() {
    asyncPredicateFunction()
      .then(defer.resolve)
      .fail( (err) => {
        if (count > max && max > 0) {
          defer.reject(
            new Error(`waitFor: poll: ${label} too many failures: ${count}`));
          return;
        }
        count += 1;
        setTimeout(poll, interval);
      });
  }
  poll();
  return defer.promise;
}

/**
  Is the given argument a function?
  @param {*} fn to test
  @return {boolean}
*/
function isFunction(fn) {
  return typeof fn === 'function';
}

/**
 * @param {function(...)} fn
 * @param {Object} api
 * @param {string=} message
 * @returns {function(...)}
 */
function nTimeoutBindFnTo(fn, api, message) {
  const promiseReturner = Q.nbind(fn, api);

  function timeoutPromise() {
    const args = Array.prototype.slice.call(arguments, 0);
    const promise = promiseReturner.apply(null, args);
    return promise.timeout(constants.PROMISE_API_TIMEOUT, message + 
      ' timed out');
  }
  return timeoutPromise;
}

/**
  Shallow iterates over a given object and *assumes* all functions are node
  callback style and converts them to Promises
 
  *NOTE* this function now produces promises that timeout based on the value in
  constants.PROMISE_API_TIMEOUT.  Clusternator only uses this function to wrap
  AWS APIs that callback within (typically) a few seconds
 
  @param {Object} api some collection/object of nodejs style functions
  @return {Object} a new object with promisified functions
*/
function makePromiseApi(api) {
  const promiseApi = {};
  let attr;
  // wrap *all* the functions !!!
  for (attr in api)
    if (isFunction(api[attr])) {
      promiseApi[attr] = nTimeoutBindFnTo(api[attr], api, attr);
    }
  return promiseApi;
}

/**
  Quick/dirty deep copy.  Will break on circular structures.
  @param {*} obj
  @return {*} copy
*/
function clone(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch(err) {
    plog('Clone Warning: ', err.message);
    return null;
  }
}

/**
 * Uses inquirer to prompt for STDIO input/output
 * @todo move this to a CLI utility section
 * @param {Array} qs
 * @param {function(...)=} onEachAnswer
 * @param {function(...)=} onEachError
 * @param {function(...)=} onComplete
 * @returns {Promise}
 */
function inquirerPrompt(qs, onEachAnswer, onEachError, onComplete) {
  const defer = Q.defer();

  if (typeof onEachAnswer === 'function') {
    inquirer.prompt(qs).process
      .subscribe(onEachAnswer, onEachError, onComplete)
      .then(defer.resolve)
      .catch(defer.reject);
  } else {
    inquirer.prompt(qs)
      .then(defer.resolve)
      .catch(defer.reject);
  }

  return defer.promise;
}

/**
 * Sets up verbosity for the CLI
 * @todo move this function into the CLI api, or somewhere else
 * @param {Object} yargs
 */
function cliLogger(yargs) {
  const INFO = 2;
  const LOG_MAX = 5;


  const argv = yargs.count('verbose')
    .alias('v', 'verbose')
    .describe('v', 'Verbosity, defaults to info, add more v\'s to increase')
    .boolean('quiet')
    .alias('q', 'quiet')
    .describe('q', 'Quiet mode, only errors will output (overrides -v)')
    .argv;

  if (argv.q) {
    winston.transports.console.level = constants.LOG_LEVELS[0];
  } else {
    let logLevel = INFO + argv.v > LOG_MAX ? LOG_MAX : INFO + argv.v;
    winston.transports.console.level = constants.LOG_LEVELS[logLevel];
  }
}

/**
 * Makes an object and its parts immutable
 * @param {Object} obj
 * @returns {Object}
 */
function deepFreeze(obj) {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }
  Object.keys(obj).forEach((prop) => obj[prop] = isObject(obj[prop]) ?
    deepFreeze(obj[prop]) :
    obj[prop]);
  return Object.freeze(obj);
}

/**
 * @param {string} string
 * @returns {null|*}
 */
function safeParse(string) {
  try {
    return JSON.parse(string);
  } catch (err) {
    return null;
  }
}

/**
 * Partially applies a function using _references_
 * @param {function(...)} fn
 * @param {Array.<*>|*} args
 * @returns {applyPartial}
 */
function partial(fn, args) {
  if (typeof fn !== 'function') {
    throw new TypeError('partial requires a function to partially apply');
  }
  if (!Array.isArray(args)) {
    if (args === undefined) {
      args = [];
    } else {
      args = [args];
    }
  }
  /**
   * @returns {*}
   */
  function applyPartial() {
    const nextArgs = Array.prototype.slice.call(arguments, 0);
    const allArgs = args.concat(nextArgs);
    return fn.apply(null, allArgs);
  }
  return applyPartial;
}

/**
 * @param {Error} err
 * @param {string} prefix
 * @returns {Error}
 */
function prefixError(err, prefix) {
  err.message = prefix + err.message;
  return err;
}

/**
 * @param {function():Promise} promiseReturningFunction
 * @param {number} retryCount times to retry
 * @param {number=} delay ms to delay retry
 * @param {number=} multiplier each failure will multiply the delay by this
 * @param {function(Error):boolean=} failOn if true fails instead of retrying
 * @param {string=} label
 * @return {function(): Promise}
 */
function makeRetryPromiseFunction(promiseReturningFunction, retryCount, delay,
                          multiplier, failOn, label) {
  // Validate parameters
  retryCount = +retryCount >= 1 ? +retryCount : 1;
  delay = +delay >= 0 ? +delay : 0;
  multiplier = +multiplier >= 1 ? +multiplier : 1;
  label = label ? label + ' ' : '';
  failOn = typeof failOn === 'function' ? failOn : () => false;

  /**
   * @return {Promise}
   */
  function promiseToRetry() {
    // Call the function
    return promiseReturningFunction()
      .fail((err) => {
        // Fail if it's failing for an expected reason
        if (failOn(err)) {
          prefixError(err, label);
          throw err;
        }

        // if there is a retry value retry
        if (retryCount > 1) {
          let d = Q.defer();

          // delay retries
          setTimeout(() => {
            debug(`makeRetryPromiseFunction: retrying ${label} ${retryCount} ` +
              `more times with a delay of ${delay} x ${multiplier}, error: ` +
              err.message);
            makeRetryPromiseFunction(
              promiseReturningFunction, retryCount - 1, delay * multiplier,
              multiplier, failOn, label)()
              .then(d.resolve, d.reject);
          }, delay);
          return d.promise;
        }

        // out of retries, throw
        prefixError(err, label);
        throw err;
      });
  }
  return promiseToRetry;
}

/**
 * Intended to handle errors at the CLI level.
 *
 * Pretty-prints messages for specific error codes and decides whether to
 * exit with 0 or 1.
 *
 * @param {string} operationDescription Describes what's being done in the CLI.
 * @param {codeMap} maps error codes to messages.
 *
 * If codeMap is omitted, or doesn't match an actual error, error.message will
 * be logged instead.
 *
 * Example:
 *
 * .fail(cliErr('Doing something with clusternator', {
 *   ENOENT: { msg: 'something not found', code: 1 },
 *   EACCES: { msg: 'no big deal' }
 * }));
 */
function cliErr(
  operationDescription,
  codeMap) {

  operationDescription = operationDescription || '';
  codeMap = codeMap || {};

  return function(error) {
    const info = codeMap[error.code];
    const code = info ? info.code : 1;

    if (info) {
      winston.info(operationDescription + ':', info.msg);
    }
    else {
      winston.error(operationDescription + ':', error);
    }

    process.exit(code);
  };
}
