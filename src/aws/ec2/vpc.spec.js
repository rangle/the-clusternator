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

  describe('findVpc function', () => {
    it('should return a function', () => {
      expect(typeof vpc.findVpc(aws)).to.equal('function');
    });

    it('should resolve if there is an existing vpc', (done) => {
      const p = vpc.findVpc(aws)();
      p.then((r) => C.check(done, () => expect(r.VpcId).to.equal('vpcId')))
        .fail(C.getFail(done));
    });
    
    it('should reject if there is no vpc', (done) => {
      aws.ec2.describeVpcs = () => Q.resolve({ Vpcs: [] });
      const p = vpc.findVpc(aws)();
      p.then(C.getFail(done))
        .fail((err) => C
          .check(done, () => expect(err instanceof Error).to.be.ok));
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
