'use strict';
/**
 * Module for generating/managing resource identifiers
 * @module resourceIdentifier
 */

const R = require('ramda');
const constants = require('./constants');
const RX_DOUBLE_DASH = /--/g;
const RX_DOUBLE_DASH_END = /--$/g;


/**
 * TYPES:
 * 'pr', 'sha', 'time', 'ttl', 'pid', 'deployment'
 * @type {string[]}
 * */
const VALID_ID_TYPES = Object
  .freeze(['pr', 'sha', 'time', 'ttl', 'pid', 'deployment']);

module.exports = {
  TYPES: VALID_ID_TYPES,
  parseRID,
  generateRID,
  generatePRSubdomain,
  generateSubdomain,
  clusternatePrefixString,
  isPrefixed,
  isRID
};


/**
 * Is the given a resource identifier?
 * @param {string} rid
 * @returns {boolean}
 * @example isRID('hello I like hamburgers'); // false
 * @example isRID('the-clusternator--my-project'); // true
 */
function isRID(rid) {
  return rid.indexOf(constants.CLUSTERNATOR_PREFIX) === 0;
}

/**
 * Extracts the key/value of an id segment and returns a map
 * @param {string} idSegment
 * @returns {{type: string, value: string}}
 */
function mapIdSegments(idSegment) {
  const dashIdx = idSegment.indexOf('-');
  const type = idSegment.substring(0, dashIdx);
  const value = idSegment.substring(dashIdx + 1);

  return {
    type: type,
    value: value
  };
}

/**
 * Produces a complete map from the given map segments
 * @param {{type: string, value: string}} memo
 * @param {{type: string, value: string}} seg
 * @returns {{}}
 */
function reduceSegments(memo, seg) {
  memo[seg.type] = seg.value;
  return memo;
}

/**
 * Convert a given resource identifier into component pieces.
 *
 * Component pieces are labelled based on elements in the TYPES array
 *
 * RID format: typeA-valueA--typeB-valueB
 *
 * @param {string} rid
 * @returns {Object}
 *
 * @example parseRID('clusternator-pid-my-project--pr-5');
  // { pid: 'my-project', pr: '5' }
 */
function parseRID(rid) {
  if (!isRID(rid)) {
    return null;
  }
  rid = rid.slice(constants.CLUSTERNATOR_PREFIX.length + 1);

  const splits = rid.split(RX_DOUBLE_DASH);
  const segments = R.map(mapIdSegments, splits);

  const result = R.reduce(reduceSegments, {}, segments);

  return result;
}


/**
 * Given component pieces, produce a resource identifier string
 *
 * Component pieces are in the form of an object hash, like:
 *
 * @param {Object} params a map of TYPEs to their values
 * @returns {string}
 *
 * @example generateRID({ pid: 'my-project', pr: '5' });
     // 'clusternator-pid-my-project--pr-5'
 */
function generateRID(params) {
  const idSegments = R
    .mapObjIndexed((val, key) => `${key}-${val}`, params);

  const validSegmentKeys = R.filter((key) => {
    return R.contains(key, VALID_ID_TYPES);
  }, R.keys(idSegments));

  const rid = R.reduce((ridStr, segKey) => `${ridStr}${idSegments[segKey]}--`,
    '', validSegmentKeys);

  if (!rid) { return ''; }

  // Remove trailing --
  const trimmedRid = rid.replace(RX_DOUBLE_DASH_END, '');
  return `${constants.CLUSTERNATOR_PREFIX}-${trimmedRid}`;
}

/**
 Generates a value to use as a subdomain
 @param {string} projectId
 @param {string} pr Pull Request number
 @return {string}
 @throws {TypeError}
 @example generatePRSubdomain('my-project', '7');
   // my-project-pr-7
 */
function generatePRSubdomain(projectId, pr) {
  if (!projectId || !pr) {
    throw new TypeError('generateSubdomain requires a projectId, and pr');
  }
  return `${projectId}-pr-${pr}`;
}

/**
 @param {string} projectId
 @param {string} label
 @return {string}
 @throws {TypeError}
 @example generateSubdomain('my-project', 'beta');
   // my-project-beta
 */
function generateSubdomain(projectId, label) {
  if (!projectId || !label) {
    throw new TypeError('generateSubdomain requires a projectId, and label');
  }
  return `${projectId}-${label}`;
}

/**
 * adds CLUSTERNATOR_PREFIX to the start of a string _if_ it is not already
 there
 * @param {string} name the string to prepend
 * @returns {string}
 * @example clusternatePrefixString('bill'); // 'the-clusternator-bill'
 * @example clusternatePrefixString('the-clusternator'); // 'the-clusternator'
 */
function clusternatePrefixString(name) {
  if (!isPrefixed(name)) {
    name = constants.CLUSTERNATOR_PREFIX + '-' + name;
  }
  return name;
}

/**
 * Determines if a given string has a clusternator prefix
 * @param {string} name
 * @returns {boolean}
 */
function isPrefixed(name) {
  return name.indexOf(constants.CLUSTERNATOR_PREFIX) === 0;
}


