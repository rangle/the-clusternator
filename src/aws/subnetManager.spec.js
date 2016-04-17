'use strict';

const rewire = require('rewire');
const Q = require('q');
const constants = require('../constants');
const common = require('./common');
const ec2Mock = require('./ec2-mock');

const Subnet = rewire('./subnetManager');
const C = require('../chai');


/*global describe, it, expect, beforeEach, afterEach */
describe('subnetManager', () => {
  let subnet;
  let cidrList = [{
      CidrBlock: '1.2.3.4'
    }, {
      CidrBlock: '1.2.200.4'
    }, {
      CidrBlock: '1.2.0.4'
    }];
  let origVPC;
  const Vpc = {};

  beforeEach(() => {
    Vpc.bindAws = () => Vpc;
    Vpc.findVpc = () => () => Q.resolve({ CidrBlock: '192.168.1.0' });
    origVPC = Subnet.__get__('Vpc');
    Subnet.__set__('Vpc', Vpc);
    subnet = Subnet(ec2Mock, 'vpc-id');
  });

  afterEach(() => {
    Subnet.__set__('Vpc', origVPC);
  });

  describe('async describe with valid list', () => {
    let oldDesc;
    let oldEc2Desc;
    beforeEach(() => {
      const subnets = [{
        CidrBlock: '192.168.0.0'
      }];
      const describeFn = () => Q.resolve(subnets);

      oldEc2Desc = ec2Mock.describeSubnets;
      ec2Mock.describeSubnets = (p, cb) => cb(null, { Subnets: subnets });
      oldDesc = common.makeEc2DescribeFn;
      common.makeEc2DescribeFn = () => describeFn;
      Subnet.__set__('common', common);
      subnet = Subnet(ec2Mock, 'vpc-id');
    });

    afterEach(() => {
      ec2Mock.describeSubnets = oldEc2Desc;
      common.makeEc2DescribeFn = oldDesc;
      Subnet.__set__('common', common);
    });

    it('should asynchronously list subnets', (done) => {
      subnet.describe().then((list) => {
        C.check(done, () => {
          expect(list).to.be.ok;
        });
      }, C.getFail(done));
    });

    it('getCidrPostfix should return the *incremented* C/D class, *and* the ' +
      '/N netmask of the mock IP data', (done) => {
        subnet.helpers.getCidrPostfix().then((result) => {
          C.check(done, () => {
            expect(result).to.equal('1.0/24');
          });
        }, C.getFail(done));
      });

    it('getNextSubnet should return a complete subnet string for the next ' +
      'highest subnet', (done) => {
        subnet.helpers.getNextSubnet().then((result) => {
          C.check(done, () => {
            expect(result).to.equal('192.168.1.0/24');
          });
        }, C.getFail(done));
      });

  });

  describe('describe failing test', () => {
    beforeEach(() => {
      ec2Mock.setDescribeSubnets(new Error('test'));
    });

    afterEach(() => {
      ec2Mock.setDescribeSubnets([1, 2, 3]);
    });

    it('should reject its promise on fail', (done) => {
      subnet.describe().then(C.getFail(done), (err) => {
        C.check(done, () => {
          expect(err instanceof Error).to.be.true;
        });
      });
    });
  });

  it('findHighestCidr should return the "highest" subnet in a collection ' +
    'of CIDR Blocks', () => {
      expect(
        subnet.helpers.findHighestCidr(cidrList)
      ).to.equal(200);
    });

  it('findHighestCidr should throw with an empty list', () => {
    expect(() => {
      subnet.helpers.findHighestCidr([]);
    }).to.throw(Error);
  });

  it('incrementHighestCidr should return the C/D classes of the highest ' +
    ' /24 block + 1', () => {
      expect(
        subnet.helpers.incrementHighestCidr(cidrList)
      ).to.equal('201.0/24');
    });

  it('isPidInSubnetList should return true if a matching pid is found in ' +
    ' a list of subnets', () => {
      expect(subnet.helpers.isPidInSubnetList('test', [{
        Tags: [{
          Key: constants.PROJECT_TAG,
          Value: 'test'
        }]
      }])).to.be.true;
    });

  it('isPidInSubnetList should return false if no match is found in a list ' +
    ' of subnets', () => {
      expect(subnet.helpers.isPidInSubnetList('test', [{
        Tags: [{
          Key: constants.PROJECT_TAG,
          Value: 'test wrong'
        }]
      }])).to.be.false;
    });

  it('destroy should throw without a pid', () => {
    expect(() => {
      subnet.destroy();
    }).to.throw(Error);
  });

  it('create should throw without a pid', () => {
    expect(() => {
      subnet.create();
    }).to.throw(Error);
  });

  it('create should throw without a routeId', () => {
    expect(() => {
      subnet.create('test-proj');
    }).to.throw(Error);
  });

  it('create should throw without an aclId', () => {
    expect(() => {
      subnet.create('test-proj', 'some-route');
    }).to.throw(Error);
  });

  it('findProjectTag should return null if given a list without a ' +
    'clusternator project tag', () => {
      expect(subnet.helpers.findProjectTag('id', [{
        Tags: [{
          Key: 'hahah',
          Value: 'not found'
        }]
      }])).to.be.null;
    });

  it('findProjectTag should return truthy if given a list with a ' +
    'clusternator project tag', () => {
      expect(subnet.helpers.findProjectTag('id', [{
        Tags: [{
          Key: constants.PROJECT_TAG,
          Value: 'id'
        }]
      }])).to.be.ok;
    });

  it('getFilteredAssociations should throw if given an empty list', () => {
    expect(() => {
      subnet.helpers.getFilteredAssociations('blah', []);
    }).to.throw(Error);
  });

  it('getFilteredAssociations should return a list of ACL associations ' +
    'matching the subnetId if the subnet is in the first list', () => {
      expect(subnet.helpers.getFilteredAssociations('test', [{
        Associations: [{
          SubnetId: '1'
        }, {
          SubnetId: '2'
        }, {
          SubnetId: 'test'
        }]
      }]).length).to.equal(1);
    });

  it('getCidrPrefix should return the A/B class of mock ip data', (done) => {
    subnet.helpers.getCidrPrefix().then((result) => {
      C.check(done, () => {
        expect(result).to.equal('192.168');
      });
    }, C.getFail(done));
  });

  it('concatSubnetComponents should join an string array with a "."', () => {
    expect(subnet.helpers.concatSubnetComponents(['a', 'b'])).to.equal('a.b');
  });


  it('associateRoute should return a promise', (done) => {
    subnet.helpers.associateRoute({
      Subnet: {}
    }).then(() => {
      C.check(done, () => {
        expect(true).to.be;
      });
    }, C.getFail(done));
  });

  it('throwIfPidFound should throw if project id is found in given list',
    () => {
      expect(() => {
        subnet.helpers.throwIfPidNotFound('test', [{
          Tags: [{
            Key: constants.PROJECT_TAG,
            Value: 'test'
          }]
        }]);
      }).to.throw(Error);
    });

  it('throwIfSubnetNotFound should throw if project id not found in given list',
    () => {
      expect(() => {
        subnet.helpers.throwIfSubnetNotFound('test', []);
      }).to.throw(Error);
    });

  it('throwIfSubnetNotFound should return the SubnetDescription if it exists',
    () => {
      const result = subnet.helpers.throwIfSubnetNotFound('test', [{
        Tags: [{
          Key: constants.PROJECT_TAG,
          Value: 'test'
        }]
      }]);
      expect(result).to.be;
    });

  it('findExistingPid, should resolve if project id not found', (done) => {
    subnet.helpers.findExistingPid().then(() => {
      C.check(done, () => {
        expect(true).to.be.ok;
      });
    }, C.getFail(done));
  });

  it('findProjectSubnet should reject if no subnet found', (done) => {
    subnet.findProject().then(C.getFail(done), (err) => {
      C.check(done, () => {

        expect(err instanceof Error).to.be;
      });
    });
  });

  it('filterIsDefault should return a list of NetworkAcl\'s tagged with ' +
    'IsDefault', () => {
      expect(subnet.helpers.filterIsDefault({
        NetworkAcls: [{
          IsDefault: false
        }, {
          IsDefault: true
        }]
      })[0].IsDefault).to.be.ok;
    });

  it('defaultAssoc should return a promise', (done) => {
    subnet.helpers.defaultAssoc().then(C.getFail(done), (err) => {
      C.check(done, () => {
        expect(err instanceof Error).to.be;
      });
    });
  });

  it('defaultAssocId should reject if subnet is not found', (done) => {
    subnet.helpers.defaultAssocId().then(C.getFail(done), (err) => {
      C.check(done, () => {
        expect(err instanceof Error).to.be;
      });
    });
  });

  it('throwIfNetworkAclAssocListEmpty should throw if list is empty', () => {
    expect(() => {
      subnet.helpers.throwIfNetworkAclAssocListEmpty([]);
    }).to.throw(Error);
  });

  it('throwIfNetworkAclAssocListEmpty should return the ' +
    'NetworkAclAssociation if the list is valid', () => {
      expect(
        subnet.helpers.throwIfNetworkAclAssocListEmpty([{
          NetworkAclAssociationId: 'test!'
        }])
      ).to.equal('test!');
    });

});
