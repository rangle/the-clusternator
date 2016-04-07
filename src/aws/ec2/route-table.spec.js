'use strict';

const Q = require('q');
const rewire = require('rewire');

const rt = rewire('./route-table');
const C = require('../../chai');

const aws = {};

function initData() {
  aws.vpcId = 'vpcId';
  aws.ec2 = {
    describeRouteTables: () => Q.resolve({
      RouteTables: [{ RouteTableId: 'routeTableId' }]
    }),
    createRouteTable: () => Q.resolve({RouteTable: true}),
    deleteRouteTable: () => Q.resolve(true),
    createTags: () => Q.resolve(true)
  };
}

/*global describe, it, expect, beforeEach, afterEach */
describe('AWS: EC2: Route Tables', () => {

  beforeEach(initData);

  describe('create function', () => {
    it('should resolve if the item already exists', (done) => {
      rt.create(aws)()
        .then((r) => C
          .check(done, () => expect(r.RouteTableId).to.equal('routeTableId')))
        .fail(C.getFail(done));
    });

    it('should call ec2.createRouteTable if the item does not exist',
      (done) => {
        aws.ec2.describeRouteTables = () => Q.resolve({ RouteTables: [] });
        rt.create(aws)()
          .then((r) => C
            .check(done, () => expect(r).to.equal(true)))
          .fail(C.getFail(done));
      });
  });

  describe('describe function', () => {
    it('should call ec2.describeRouteTables', (done) => {
      rt.describe(aws)()
        .then((r) => C
          .check(done, () => expect(r).to.be.ok), C.getFail(done));
    });
  });

  describe('destroy function', () => {
    it('should call ec2.deleteRouteTable', (done) => {
      rt.describe(aws, 'routeTableId')()
        .then((r) => C
          .check(done, () => expect(r).to.be.ok), C.getFail(done));
    });
  });

  describe('list function', () => {
    it('resolve an array of strings', (done) => {
      rt.list(aws)()
        .then((r) => C
          .check(
            done,
            () => expect(typeof r[0]).to.equal('string')),
            C.getFail(done)
          );
    });
  });

  describe('findDefault function', () => {
    it('should return a promise', () => {
      expect(typeof rt.findDefault(aws)).to.equal('function');
    });

    it('should return a resolving promise (if describe works)', (done) => {
      const p = rt.findDefault(aws)();
      p.then(() => C.check(done, () => expect(true).to.be.ok))
        .fail(C.getFail(done));
    });

    it('should return a rejecting promise (if describe returns an empty array)',
      (done) => {
        aws.ec2.describeRouteTables = () => Q.resolve({ RouteTables: [] });
        const p = rt.findDefault(aws)();
        p.then(C.getFail(done))
          .fail((err) => C
            .check(done, () => expect(err instanceof Error).to.be.ok));
      });
  });

  describe('bindAws function', () => {
    it('should partially apply aws to the API', (done) => {
      const rbound = rt.bindAws(aws);
      const p = rbound.findDefault()();
      p.then(() => C.check(done, () => expect(true).to.be.ok))
        .fail(C.getFail(done));
    });
  });

  describe('destroy function', () => {
    it('should throw without an id', () => {
      expect(() => rt.destroy(aws)).to.throw(TypeError);
    });
    
    it('should return a function', () => {
      expect(typeof rt.destroy(aws, 'rtId')).to.equal('function');
    });

    it('should resolve "already deleted" if the id is _not_ in the list',
      (done) => {
        const p = rt.destroy(aws, 'rtId')();
        p.then((r) => C
          .check(done, () => expect(r).to.equal('already deleted')))
          .fail(C.getFail(done));
      });
    
    it('should resolve "deleted" if the id _is_ in the list',
      (done) => {
        const p = rt.destroy(aws, 'routeTableId')();
        p.then((r) => C
          .check(done, () => expect(r).to.equal('deleted')))
          .fail(C.getFail(done));
      });
  });
});