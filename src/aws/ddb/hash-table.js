'use strict';

const WRITE_UNITS = 10;
const READ_UNITS = 10;
const MAX_LISTED_RESULTS = 100;

const Q = require('q');
const util = require('../../util');
const awsCommon = require('../common');

const clusternatePrefixString = require('../../resource-identifier')
  .clusternatePrefixString;

const EXPORTS = {
  bindAws,
  accessor,
  create,
  destroy,
  hashTable,
  key,
  list: listAllTables,
  remove,
  helpers: {
    checkIfTableExists,
    checkAndWrite,
    makeDdbItem,
    read,
    write
  }
};

module.exports = EXPORTS;

/**
 * @param {AwsWrapper} aws
 * @returns {Object.<function(...)>}
 */
function bindAws(aws) {
  return awsCommon.bindAws(aws, EXPORTS);
}

/**
 * Returns a function that will get/set on the table/id provided.
 * @param {AwsWrapper} aws
 * @param {string} table
 * @param {string} id
 * @returns {function(string=)}
 */
function key(aws, table, id) {
  return util.partial(accessor, [ aws, table, id ]);
}

/**
 * Returns a function that will get/set
 * @param {AwsWrapper} aws
 * @param {string} table
 * @returns {function(string, string=)}
 */
function hashTable(aws, table) {
  return util.partial(accessor, [ aws, table ]);
}

/**
 * @param {AwsWrapper} aws
 * @param {string} table
 * @param {string} key
 * @param {*} value
 * @returns {Function}
 * @throws {TypeError}
 */
function accessor(aws, table, key, value) {

  if(value === undefined && key) {
    key += '';
    return read(aws, table, key);
  } else if (key) {
    key += '';
    return checkAndWrite(aws, table, key, value);
  } else {
    throw new TypeError(`hashTable ${table}: accessor given invalid key ` +
      `(${key}:<${typeof key}>)`);
  }
}

/**
 * @param {string} key
 * @param {*} value
 * @returns {{ id: { S: string }, value: { S: string }}}
 */
function makeDdbItem(key, value) {
  if (typeof value !== 'string') {
    value = JSON.stringify(value);
  }
  return {
    id: {
      S: key
    },
    value: {
      S: value
    }
  };
}

/**
 * @param {AwsWrapper} aws
 * @param {string} table
 * @param {string} key
 * @param {*} value
 * @returns {writeToAws}
 * @throws {TypeError}
 */
function write(aws, table, key, value) {
  if (!table || !key) {
    throw new TypeError('write requires a table, key, and value');
  }
  value = value || '';
  /**
   * @returns {Promise}
   */
  function writeToAws() {
    return aws.ddb.putItem({
      TableName: clusternatePrefixString(table),
      Item: makeDdbItem(key, value)
    });
  }
  return writeToAws;
}

/**
 * @param {AwsWrapper} aws
 * @param {string=} lastName
 * @returns {promiseToListTables}
 */
function listAllTables(aws, lastName) {
  /**
   * @returns {Promise.<Array.<string>>}
   */
  function promiseToListTables() {
    const listParams = {};
    if (lastName) {
      listParams.ExclusiveStartTableName = lastName;
    }
    return aws.ddb.listTables(listParams)
      .then((data) => {
        if (!data.TableNames) {
          return Q.reject(new Error('AWS Result missing TableNames'));
        }
        if (data.TableNames.length >= MAX_LISTED_RESULTS) {
          const lastTable = data.TableNames[data.TableNames.length - 1];

          return listAllTables(aws, lastTable)()
            .then((list) => data.TableNames.concat(list));
        }
        return data.TableNames;
      });
  }
  return promiseToListTables;
}

/**
 * Returns a promise returning function that checks if a table exists
 * @param {AwsWrapper} aws
 * @param {string} table
 * @returns {promiseToCheckIfTableExists}
 * @throws {TypeError}
 */
function checkIfTableExists(aws, table) {
  if (!table) {
    throw new TypeError('checkIfTableExists requires a table name');
  }
  /**
   * @returns {Promise<boolean>}
   */
  function promiseToCheckIfTableExists() {
    return listAllTables(aws)()
      .then((list) => list.indexOf(clusternatePrefixString(table)) !== -1);
  }
  return promiseToCheckIfTableExists;
}

/**
 * Returns a function that promises to create a hash table
 * @param {AwsWrapper} aws
 * @param {string} table
 * @returns {promiseToCreate}
 * @throws {TypeError}
 */
function create(aws, table) {
  if (!table) {
    throw new TypeError('create requires a table name');
  }
  /**
   * @returns {Promise<string>}
   */
  function promiseToCreate() {
    return checkIfTableExists(aws, table)()
      .then((tableExists) => tableExists ?
        'table exists' :
        aws.ddb.createTable({
          AttributeDefinitions: [{
            AttributeName: 'id',
            AttributeType: 'S'
          }
          ],
          KeySchema: [{
            AttributeName: 'id',
            KeyType: 'HASH'
          }],
          ProvisionedThroughput: {
            ReadCapacityUnits: READ_UNITS,
            WriteCapacityUnits: WRITE_UNITS
          },
          TableName: clusternatePrefixString(table)
        })
      .then(() => 'table created'));
  }
  return promiseToCreate;
}

/**
 * Returns a function that promises to check if a table exists, create it if it
 * doesn't, and finally, write to it
 * @param {AwsWrapper} aws
 * @param {string} table
 * @param {string} key
 * @param {*} value
 * @returns {promiseToCheckAndWrite}
 * @throws {TypeError}
 */
function checkAndWrite(aws, table, key, value) {
  if (!table || !key) {
    throw new TypeError('checkAndWrite requires a table name and key');
  }
  /**
   * @returns {Promise}
   */
  function promiseToCheckAndWrite() {
    return checkIfTableExists(aws, table)()
      .then((tableExists) => {
        if (tableExists) {
          return write(aws, table, key, value)();
        } else {
          return create(aws, table)()
            .then(() => write());
        }
      });
  }
  return promiseToCheckAndWrite;
}

/**
 * @param {string} key
 * @returns {{ id: { S: string }}}
 */
function makeReadKey(key) {
  return {
    id: {
      S: key
    }
  };
}

/**
 * Returns a function that promises to read a given key
 * @param {AwsWrapper} aws
 * @param {string} table
 * @param {string} key
 * @returns {promiseToGetItem}
 * @throws {TypeError}
 */
function read(aws, table, key) {
  if (!table || !key) {
    throw new TypeError('read requires a table and a key');
  }
  /**
   * @returns {Promise<string>}
   */
  function promiseToGetItem() {
    return aws.ddb.getItem({
      TableName: clusternatePrefixString(table),
      Key: makeReadKey(key)
    }).then((result) => {
      if (!result.Item) {
        throw new Error(`expected Item in result set for ${table}.${key}: ` +
          Object.keys(result) + ': ' + typeof result);
      }
      return result.Item.value.S;
    });
  }
  return promiseToGetItem;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} table
 * @returns {promiseToDestroy}
 * @throws {TypeError}
 */
function destroy(aws, table) {
  if (!table) {
    throw new TypeError('destroy requires a table');
  }
  /**
   * @returns {Promise}
   */
  function promiseToDestroy() {
    return aws.ddb.deleteTable({
      TableName: clusternatePrefixString(table)
    }).then(null, () => {});
  }
  return promiseToDestroy;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} table
 * @param {string} key
 * @returns {promiseToRemove}
 * @throws {TypeError}
 */
function remove(aws, table, key) {
  if (!table || !key) {
    throw new TypeError('removey requires a table and key');
  }
  /**
   * @returns {Promise}
   */
  function promiseToRemove() {
    return aws.ddb.deleteItem({
      Key: {
        id: {
          S: key
        }
      },
      TableName: clusternatePrefixString(table)
    }).then(null, () => {});
  }
  return promiseToRemove;
}
