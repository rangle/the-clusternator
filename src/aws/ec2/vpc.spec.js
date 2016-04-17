'use strict';

const Q = require('q');
const rewire = require('rewire');

const vpc = rewire('./vpc');
const C = require('../../chai');
const constants = require('../../constants');

const aws = {};

function initData() {
  aws.ec2 = {
    describeVpcs: () => Q.resolve({
      Vpcs: [{ VpcId: 'vpcId' }]
    }),
    createVpc: () => Q.resolve({Vpc: true}),
    deleteVpc: () => Q.resolve(true),
    createTags: () => Q.resolve(true)
  };
}

/*global describe, it, expect, beforeEach, afterEach */
describe('AWS: EC2: VPC', () => {

  beforeEach(initData);

  describe('create function', () => {
    it('should resolve the existing vpc if it exists', (done) => {
      vpc.create(aws)()
        .then((r) => C
          .check(done, () => expect(r.VpcId).to.equal('vpcId')), 
          C.getFail(done));
    });
    
    it('should call ec2.createVpc if there is no vpc', (done) => {
      aws.ec2.describeVpcs = () => Q.resolve({ Vpcs: [] });
      vpc.create(aws)()
        .then((r) => C
          .check(done, () => expect(r).to.equal(true)), C.getFail(done));
    });
  });

  describe('describe function', () => {
    it('should call ec2.describeVpcs', (done) => {
      vpc.describe(aws)()
        .then((r) => C
          .check(done, () => expect(r).to.be.ok), C.getFail(done));
    });
  });

  describe('destroy function', () => {
    it('should throw without a vpcId', () => {
      expect(() => vpc.destroy(aws)).to.throw(TypeError);
    });
    
    it('should resolve "already deleted" if the vpcId is not found', (done) => {
      vpc.destroy(aws, 'vpcIdasdfads')()
        .then((r) => C
          .check(done, () => expect(r).to.equal('already deleted')), 
          C.getFail(done));
    });
    
    it('should resolve "deleted" if it has to delete', (done) => {
      vpc.destroy(aws, 'vpcId')()
        .then((r) => C
          .check(done, () => expect(r).to.equal('deleted')),
          C.getFail(done));
    });
  });

  describe('list function', () => {
    it('resolve an array of strings', (done) => {
      vpc.list(aws)()
        .then((r) => C
          .check(
            done,
            () => expect(typeof r[0]).to.equal('string')),
            C.getFail(done)
          );
    });
  });

  describe('findProjectTag function', () => {
    describe('findVpc function', () => {
    it('should return truthy if given a list without a clusternator ' +
        'project tag', () => {
      expect(vpc.findVpc({
        Vpcs: [{
          Tags: [{
            Key: 'I have no tags',
            Value: 'id'
          }]
        }]
      })()).to.be.ok;
    });

    it('should return null if given a list with a clusternator ' +
        'project tag', () => {
        expect(vpc.findVpc({
          Vpcs: [{
            Tags: [{
              Key: constants.CLUSTERNATOR_TAG,
              Value: 'id'
            }]
          }]
        })()).to.be['null'];
      });
    });
  });

  describe('bindAws function', () => {
    it('should partially apply aws to API', (done) => {
      const vbound = vpc.bindAws(aws);
      vbound.create()()
        .then((r) => C
          .check(done, () => expect(r.VpcId).to.equal('vpcId')),
          C.getFail(done));
    });
  });
});
