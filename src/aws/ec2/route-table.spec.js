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
    deleteRouteTable: () => Q.resolve(true)
  };
}

/*global describe, it, expect, beforeEach, afterEach */
describe('AWS: EC2: Route Tables', () => {

  beforeEach(initData);

  describe('create function', () => {
    it('should call ec2.createRouteTable', (done) => {
      rt.create(aws)()
        .then((r) => C
          .check(done, () => expect(r).to.be.ok), C.getFail(done));
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

});