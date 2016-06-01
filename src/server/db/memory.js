'use strict';

const Q = require('q');
const util = require('../../util');

const EXPORTS = {
  bindDb,
  accessor,
  create,
  destroy,
  hashTable,
  key,
  list,
  remove
};

module.exports = EXPORTS;

/**
 * Binds all functions' first parameters to a given object
 * @param {Object} dbs
 * @returns {Object}
 * @throws {TypeError}
 */
function bindDb(dbs) {
  if (!dbs) {
    throw new TypeError('bindDb requires a db object to bind to');
  }
  const API = Object.create(null);
  Object.keys(EXPORTS).forEach((attr) => {
    if (attr === 'bindDb') {
      return;
    }
    if (typeof EXPORTS[attr] === 'function') {
      API[attr] = util.partial(EXPORTS[attr], dbs);
    }
  });
  return API;
}

/**
 * @param {Object} dbs
 * @returns {promiseToList}
 */
function list(dbs) {
  /**
   * @returns {Promise<Array<string>>}
   */
  function promiseToList() {
    return Q.resolve(Object.keys(dbs));
  }
  return promiseToList;
}

/**
 * Returns a function that will get/set on the table/id provided.
 * @param {Object} dbs
 * @param {string} table
 * @param {string} id
 * @returns {function(string=)}
 */
function key(dbs, table, id) {
  return util.partial(accessor, [ dbs, table, id ]);
}

/**
 * Returns a function that will get/set
 * @param {Object} dbs
 * @param {string} table
 * @returns {function(string, string=)}
 */
function hashTable(dbs, table) {
  return util.partial(accessor, [ dbs, table ]);
}

/**
 * @param {Object} dbs
 * @param {string} table
 * @param {string} key
 * @param {string=} value
 * @returns {promiseToAccessTable}
 */
function accessor(dbs, table, key, value) {
  /**
   * @returns {Promise}
   */
  function promiseToAccessTable() {
    if (!dbs[table]) {
      return Q.reject(new Error(`accessor: table ${table} not found`));
    }
    if (!key) {
      return Q.reject(new Error('accessor: requires a key value'));
    }
    if (key && value === undefined) {
      if (dbs[table][key] === undefined) {
        return Q.reject(new Error('key not found'));
      }
      return Q.resolve(dbs[table][key]);
    }
    dbs[table][key] = value;
    return Q.resolve(dbs[table][key]);
  }
  return promiseToAccessTable;
}

/**
 * @param {Object} dbs
 * @param {string} table
 * @returns {promiseToCreate}
 */
function create(dbs, table) {
  /**
   * @returns {Promise<string>}
   */
  function promiseToCreate() {
    if (dbs[table]) {
      return Q.resolve('table exists');
    }
    dbs[table] = Object.create(null);
    return Q.resolve('table created');
  }
  return promiseToCreate;
}

/**
 * @param {Object} dbs
 * @param {string} table
 * @returns {promiseToDestroy}
 */
function destroy(dbs, table) {
  /**
   * @returns {Promise}
   */
  function promiseToDestroy() {
    if (!dbs[table]) {
      return Q.resolve('already destroyed');
    }
    delete dbs[table];
    return Q.resolve('table destroyed');
  }
  return promiseToDestroy;
}

/**
 * Removes a key from a table
 * @param {Object} dbs
 * @param {string} table
 * @param {string} key
 * @returns {promiseToRemove}
 * @throws {TypeError}
 */
function remove(dbs, table, key) {
  if (!key) {
    throw new TypeError('remove requires a key');
  }
  /**
   * @returns {Promise<string>}
   */
  function promiseToRemove() {
    if (!dbs[table]) {
      return Q.resolve('table does not even exist');
    }
    if (dbs[table][key] === undefined) {
      return Q.resolve('key does not exist');
    }
    delete dbs[table][key];
    return Q.resolve('key deleted');
  }
  return promiseToRemove;
}
