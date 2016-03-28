const Q = require('q');
const rewire = require('rewire');

const vpc = rewire('./vpc');
const C = require('../../chai');

const aws = {};

function initData() {
  aws.ec2 = {
    describeVpcs: () => Q.resolve({
      Vpcs: [{ VpcId: 'vpcId' }]
    }),
    createVpc: () => Q.resolve({Vpc: true}),
    deleteVpc: () => Q.resolve(true)
  };
}

/*global describe, it, expect, beforeEach, afterEach */
describe('AWS: EC2: VPC', () => {

  beforeEach(initData);

  describe('create function', () => {
    it('should call ec2.createVpc', (done) => {
      vpc.create(aws, 'cidrBlock')()
        .then((r) => C
          .check(done, () => expect(r).to.be.ok), C.getFail(done));
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
    it('should call ec2.deleteVpc', (done) => {
      vpc.describe(aws, 'vpcId')()
        .then((r) => C
          .check(done, () => expect(r).to.be.ok), C.getFail(done));
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

});