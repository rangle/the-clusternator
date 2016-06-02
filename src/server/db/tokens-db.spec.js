'use strict';

const rewire = require('rewire');
const tokensDb = rewire('./tokens-db');
const C = require('../../chai');

/*global describe, it, expect, beforeEach, afterEach */
describe('Tokens DB', () => {
  let hashTable;

  describe('createAccessor', () => {
    it('should return a function', () => {
      expect(
        typeof tokensDb.createAccessor(hashTable, 'secret') === 'function')
        .to.be.ok;
    });
  });

  describe('pruneRecord function', () => {
    it('should throw if not given a record', () => {
      expect(() => tokensDb.pruneRecord()).to.throw(Error);
    });
    it('should throw if not given a record.id', () => {
      expect(() => tokensDb.pruneRecord({ saltedHashes: [] })).to.throw(Error);
    });
    it('should throw if not given a record.saltedHashes array', () => {
      expect(() => tokensDb.pruneRecord({ id: 't' }))
        .to.throw(Error);
    });
    it('should throw if record.saltedHashes is not an array', () => {
      expect(() => tokensDb.pruneRecord({ id: 't' , saltedHashes: {} }))
        .to.throw(Error);
    });

    it('should return an object', () => {
      expect(tokensDb
          .pruneRecord({ id: 't', saltedHashes: [] }).id === 't').to.be.ok;
    });
  });

});
