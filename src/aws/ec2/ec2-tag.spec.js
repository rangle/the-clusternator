'use strict';

const Q = require('q');
const rewire = require('rewire');

const ec2 = rewire('./ec2-tag');
const C = require('../../chai');

const aws = {};

function initData() {
  aws.ec2 = {
    createTags: () => Q.resolve(true),
    deleteTags: () => Q.resolve(true)
  };
}


/*global describe, it, expect, beforeEach, afterEach */
describe('AWS: EC2: Tag', () => {

  beforeEach(initData);

  describe('create function', () => {
    it('should throw without a value', () => {
      expect(() => ec2.create('test')).to.throw(TypeError);
    });

    it('should throw without a key', () => {
      expect(() => ec2.create()).to.throw(TypeError);
    });

    it('should return an Ec2Tag', () => {
      expect(ec2.create('test', 'me') instanceof ec2.Ec2Tag).to.be.ok;
    });
  });

  describe('tag function', () => {
    it('should throw without a tags array', () => {
      expect(() => ec2.tag(aws, [], 'me')).to.throw(TypeError);
    });

    it('should throw without a resources array', () => {
      expect(() => ec2.tag(aws, 'test', [])).to.throw(TypeError);
    });

    it('should return a function that calls ec2.createTags', (done) => {
      ec2.tag(aws, [], [])()
        .then((r) => C
          .check(done, () => expect(r).to.equal(true)), C.getFail(done));
    });
  });
  
  describe('unTag function', () => {
    it('should throw without a tags array', () => {
      expect(() => ec2.unTag(aws, [], 'me')).to.throw(TypeError);
    });

    it('should throw without a resources array', () => {
      expect(() => ec2.unTag(aws, 'test', [])).to.throw(TypeError);
    });

    it('should return a function that calls ec2.deleteTags', (done) => {
      ec2.unTag(aws, [], [])()
        .then((r) => C
          .check(done, () => expect(r).to.equal(true)), C.getFail(done));
    });
  });


  describe('createClusternator function', () => {
    it('should return an Ec2Tag', () => {
      expect(ec2.createClusternator() instanceof ec2.Ec2Tag).to.be.ok;
    });
  });

  describe('createDeployment function', () => {
    it('should return an Ec2Tag', () => {
      expect(ec2.createDeployment('master') instanceof ec2.Ec2Tag).to.be.ok;
    });
  });

  describe('createProject function', () => {
    it('should return an Ec2Tag', () => {
      expect(ec2.createProject('test') instanceof ec2.Ec2Tag).to.be.ok;
    });
  });
  
  describe('createName function', () => {
    it('should return an Ec2Tag', () => {
      expect(ec2.createName('test') instanceof ec2.Ec2Tag).to.be.ok;
      expect(ec2.createName('test').Key).to.equal('Name');
    });
  });

  describe('createPr function', () => {
    it('should return an Ec2Tag', () => {
      expect(ec2.createPr('46') instanceof ec2.Ec2Tag).to.be.ok;
    });
  });
  
  describe('createExpiry function', () => {
    it('should force ttl\'s to be greater than or equal to zero', () => {
      // note this test has a threshold of ~5ms b/c of execution time
      const then = Date.now();
      expect(parseInt(ec2.createExpires(-23).Value, 10) >= then).to.be.ok;
    });
    
    it('should return an Ec2Tag', () => {
      expect(ec2.createExpires('46') instanceof ec2.Ec2Tag).to.be.ok;
    });
  });
});
