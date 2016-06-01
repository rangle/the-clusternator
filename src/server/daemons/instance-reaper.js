'use strict';
/**
 * This module deals with TTL/Expiry based destruction of AWS resources
 *
 * @module server/daemons/instanceReaper
 */

const DEFAULT_INTERVAL = 5 * 60 * 1000;
const util = require('../../util');

let intervalID = null;

module.exports = watch;

/**
 * @param {{ destroyExpiredPRs: function(...) }} pm
 * @param {number=} interval override
 * @returns {stop}
 */
function watch(pm, interval) {
  if (intervalID) {
    return stop;
  }
  interval = interval || DEFAULT_INTERVAL;

  intervalID = setInterval(pm.destroyExpiredPRs, interval);

  util.info('Starting to watch for expired PR\'s');
  function stop() {
    if (intervalID) {
      util.info('Expired PR watcher no longer watching');
      clearInterval(intervalID);
      intervalID = null;
    } 
  }

  return stop;
}

