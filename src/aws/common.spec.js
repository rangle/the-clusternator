'use strict';

const common = require('./common');
const Q = require('q');
const util = require('../util');
const constants = require('../constants');
const C = require('../chai');
const rid = require('../resource-identifier');

let ec2 = require('./ec2-mock');



/*global describe, it, expect, beforeEach */
describe('common AWS functions', () => {
  // all AWS wrappers use a promise wrapped ec2 object
  ec2 = util.makePromiseApi(ec2);

  it('should have a function that makes an AWS key/value filter', () => {
    expect(common.makeAWSFilter('t', 1)).to.be;
  });

  it('should have a function that makes an AWS VPC filter', () => {
    expect(common.makeAWSFilter(1)).to.be;
  });

  it('throwInvalidPidTag should throw', () => {
    expect(() => {
      common.throwInvalidPidTag();
    }).to.throw(Error);
  });

  it('throwInvalidPidPrTag should throw', () => {
    expect(() => {
      common.throwInvalidPidPrTag();
    }).to.throw(Error);
  });

  it('throwInvalidPidDeploymentTag should throw', () => {
    expect(() => {
      common.throwInvalidPidDeploymentTag();
    }).to.throw(Error);
  });

  it('areTagsPidValid should return true if pid tags match given pid', () => {
    expect(common.areTagsPidValid('test', [{
      Key: 'red herring',
      Value: 'not useful'
    }, {
      Key: constants.PROJECT_TAG,
      Value: 'test'
    }])).to.be.true;
  });

  it('areTagsPidValid should return false if pid tags do not match given pid',
    () => {
      expect(common.areTagsPidValid('test', [{
        Key: 'red herring',
        Value: 'not useful'
      }])).to.be.false;
    });

  it('areTagsPidPrValid should return true if pid/pr tags match given pid/pr',
    () => {
      expect(common.areTagsPidPrValid('test', 'pr', [{
        Key: 'red herring',
        Value: 'not useful'
      }, {
        Key: constants.PROJECT_TAG,
        Value: 'test'
      }, {
        Key: constants.PR_TAG,
        Value: 'pr'
      }])).to.be.true;
    });

  it('areTagsPidPrValid should return false if pid/pr tags do not match ' +
    'given pid', () => {
    expect(common.areTagsPidPrValid('test', 'pr', [{
      Key: 'red herring',
        Value: 'not useful'
      }, {
        Key: constants.PR_TAG,
        Value: 'pr'
      }])).to.be.false;
    });

  it('areTagsPidPrValid should return false if pid/pr tags do not match ' +
    'given pr', () => {
      expect(common.areTagsPidPrValid('test', 'pr', [{
        Key: 'red herring',
        Value: 'not useful'
      }, {
        Key: constants.PROJECT_TAG,
        Value: 'test'
      }])).to.be.false;
    });

  it('awsTagEc2 should return a promise if given a resource string, and ' +
    'a tags array', () => {
      expect(typeof common.awsTagEc2(ec2, 'test', []).then).
      to.equal('function');
    });

  it('awsTagEc2 should return a promise if given a resource array, and ' +
    'a tags array', () => {
      expect(typeof common.awsTagEc2(ec2, ['test'], []).then).
      to.equal('function');
    });

  it('makeEc2DescribeFn should return a function that takes an array and ' +
    'plucks the expected result value from an ec2 describe call', (done) => {
      const descFn = common.makeEc2DescribeFn({
        test: () => {
          return Q.resolve({
            demo: 'result!'
          });
        }
      }, 'test', 'demo', []);
      descFn(['a', 'b']).then((result) => {
        C.check(done, () => {
          expect(result).to.equal('result!');
        });
      }, C.getFail(done));
    });

  it('makeEc2DescribeFn should return a function that takes a primitive and ' +
    'plucks the expected result value from an ec2 describe call', (done) => {
    const descFn = common.makeEc2DescribeFn({
      test: () => {
        return Q.resolve({
          demo: 'result!'
        });
      }
    }, 'test', 'demo', []);
    descFn('a').then((result) => {
      C.check(done, () => {
        expect(result).to.equal('result!');
      });
    }, C.getFail(done));
  });

  it('makeEc2DescribeDeployment should return a function that executes ' +
    'a describe function', () => {
    const descFn = common.makeEc2DescribeDeployment((p) => {
      expect(p).to.be.ok;
    });
    descFn();
  });
  
  it('findFromEc2Describe should throw if there are no results', () => {
    expect(() => {
      common.findFromEc2Describe('a', []);
    }).to.throw(Error);
  });

  it('findFromEc2Describe should return an empty string if attr is not found',
    () => {
      expect(
        common.findFromEc2Describe('a', [{ Instances: [

        ]}]) === ''
      ).to.be.ok;
    });

  it('findFromEc2Describe should return the last found attribute',
    () => {
      expect(
        common.findFromEc2Describe('a', [{ Instances: [
          { a: 5 },
          { a: 7 }
        ]}]) === 7
      ).to.be.ok;
    });

  it('findIdFromEc2Describe should return the last found id',
    () => {
      expect(
        common.findIdFromEc2Describe([{ Instances: [
          { InstanceId: 5 },
          { InstanceId: 7 }
        ]}]) === 7
      ).to.be.ok;
    });

  it('findIpFromEc2Describe should throw if ip is falsey', () => {
    expect(() => {
      common.findIpFromEc2Describe([{ Instances: [
        { PublicIpAddress: null }
      ]}]);
    }).to.throw(Error);
  });

  it('findIpFromEc2Describe should return the last found ip',
    () => {
      expect(
        common.findIpFromEc2Describe([{ Instances: [
          { PublicIpAddress: 5 },
          { PublicIpAddress: 7 }
        ]}]) === 7
      ).to.be.ok;
    });
  
  it('getDeregisterClusterFunction should return a function', () => {
    expect(typeof common.getDeploymentFilter() === 'function').to.be.ok;
  });

  it('getDeregisterClusterFunction should return a function that returns a ' +
    'promise', () => {
    const promise = common
      .getDeregisterClusterFn({ deregister: Q.resolve }, 't')();
    expect(typeof promise.then === 'function').to.be.ok;
  });
  
  it('filterValidArns should return true if given a valid arn', () => {
    const id = rid.generateRID({ pid: 'hello' });
    const arn = 'some/amazon/stuff/' + id;
    expect(common.filterValidArns(arn) === true).to.be.ok;
  });

  it('filterValidArns should return false if given an invalid arn', () => {
    const arn = 'some/amazon/stuff/blababaa';
    expect(common.filterValidArns(arn) === false).to.be.ok;
  });
  
  it('getProjectIdFilter should return a function', () => {
    expect(typeof common.getProjectIdFilter('hello') === 'function').to.be.ok;
  });

  it('getProjectIdFilter should return a function that returns false if the ' +
    'given arn does not have the given projectId', () => {
    const result = common.getProjectIdFilter('hello')(rid.generateRID({
      pid: 'not hello'
    }));
    expect(result === false).to.be.ok;
  });

  it('getProjectIdFilter should return a function that returns true if the ' +
    'given arn has the given projectId', () => {
    const result = common.getProjectIdFilter('hello')(rid.generateRID({
      pid: 'hello'
    }));
    expect(result === true).to.be.ok;
  });

  it('getPrFilter should return a function', () => {
    expect(typeof common.getPrFilter('hello', 'tpr') === 'function').to.be.ok;
  });

  it('getPrFilter should return a function that returns false if the ' +
    'given arn does not have the given Pr', () => {
    const result = common.getPrFilter('hello', 'tpr')(rid.generateRID({
      pid: 'hello',
      pr: 'not tpr'
    }));
    expect(result === false).to.be.ok;
  });

  it('getPrFilter should return a function that returns true if the ' +
    'given arn has the given Pr', () => {
    const result = common.getPrFilter('hello', 'tpr')(rid.generateRID({
      pid: 'hello',
      pr: 'tpr'
    }));
    expect(result === true).to.be.ok;
  });

  it('getDeploymentFilter should return a function', () => {
    expect(typeof common.getDeploymentFilter('hello', 'tpr') === 'function')
      .to.be.ok;
  });

  it('getDeploymentFilter should return a function that returns false if the ' +
    'given arn does not have the given Deployment', () => {
    const result = common.getDeploymentFilter('hello', 'td')(rid.generateRID({
      pid: 'hello',
      deployment: 'not td'
    }));
    expect(result === false).to.be.ok;
  });

  it('getDeploymentFilter should return a function that returns true if the ' +
    'given arn has the given Deployment', () => {
    const result = common.getDeploymentFilter('hello', 'tdep')(rid.generateRID({
      pid: 'hello',
      deployment: 'tdep'
    }));
    expect(result === true).to.be.ok;
  });
  
  it('qualifyUrl should join config.tld with the given url', () => {
    expect(common.qualifyUrl({ tld: '.org' }, 'hello') === 'hello.org')
      .to.be.ok;
  });

  it('qualifyUrl should join config.tld with the given url and add a leading ' +
    '"." to tld if it does not exist', () => {
    expect(common.qualifyUrl({ tld: 'org' }, 'hello') === 'hello.org')
      .to.be.ok;
  });

  describe('filterClusterListForName function', () => {
    it('should return a function', () => {
      expect(typeof common.filterClusterListForName('hi')).to.equal('function');
    }); 
    
    it('s returned function should match name if last string after / in ' +
      'given list matches name', () => {
      const filter = common.filterClusterListForName('hello');
      expect(filter('something/something/hello')).to.equal(true);
    });
  });

  describe('processZduClusterResults function', () => {
    it('should return a function', () => {
      expect(typeof common.processZduClusterResults('name'))
        .to.equal('function');
    }); 
    
    it('s returned function should throw if results[0]/[1] are both empty ' +
      'arrays', () => {
      const fn = common.processZduClusterResults('name');
      expect(() => fn([[], []])).to.throw(Error);
    });
    
    it('s returned function should throw if results[2]/[3] are both empty ' +
      'arrays', () => {
      const fn = common.processZduClusterResults('name');
      expect(() => fn([['1'], [], [], []])).to.throw(Error);
    });
    
    it('s returned function should throw if results[0]/[1] are both full ' +
      'arrays', () => {
      const fn = common.processZduClusterResults('name');
      expect(() => fn([['1'], ['1'], ['1'], []])).to.throw(Error);
    });
    
    it('s returned function should throw if results[2]/[3] are both full ' +
      'arrays', () => {
      const fn = common.processZduClusterResults('name');
      expect(() => fn([['1'], [], ['1'], ['1']])).to.throw(Error);
    });
    
    it('s returned function should throw if result[0] exists and result[2] ' +
      'does not', () => {
      const fn = common.processZduClusterResults('name');
      expect(() => fn([['1'], [], [], ['1']])).to.throw(Error);
      
    });
    
    it('s returned function should throw if result[0] does not exist and ' +
      'result[2] exists', () => {
      const fn = common.processZduClusterResults('name');
      expect(() => fn([[], ['1'], ['1'], []])).to.throw(Error);
    });
    
    it('s returned function should throw if result[1] exists and result[3] ' +
      'does not', () => {
      const fn = common.processZduClusterResults('name');
      expect(() => fn([[], ['1'], ['1'], []])).to.throw(Error);
    });
    
    it('s returned function should throw if result[1] does not exist and ' +
      'result[3] exists', () => {
      const fn = common.processZduClusterResults('name');
      expect(() => fn([['1'], [], [], ['1']])).to.throw(Error);
    });
    
    it('should return the alt name if the original name exists', () => {
      const fn = common.processZduClusterResults('name');
      expect(fn([['1'], [], ['1'], []])).to.deep.equal({ 
        clusterNameExisting: 'name',
        clusterNameNew: 'name-alt'
      });
    });
    
    it('should return the original name if the alt name exists', () => {
      const fn = common.processZduClusterResults('name');
      expect(fn([[], ['1'], [], ['1']])).to.deep.equal({
        clusterNameExisting: 'name-alt',
        clusterNameNew: 'name'
      });
    });
  });

  describe('zduClusterNames function', () => {
    it('should return a function', () => {
      expect(typeof common.zduClusterNames()).to.equal('function');
    }); 
  });
  
  describe('bindAws function', () => {
    const aws = {};
    
    it('should throw without a target object', () => {
      expect(() => common.bindAws(aws)).to.throw(TypeError);
    });
    it('should return a copy of the api bound with an aws object', () => {
      let testAws = false;
      const verboseApi = { test: (aws) => { testAws = aws ? true : false; }};
      common.bindAws(aws, verboseApi).test();
      expect(testAws).to.equal(true);
    });

    it('should preserve non-functions on API', () => {
      const verboseApi = { test: () => {}, direct: 'direct' };
      expect(common.bindAws(aws, verboseApi).direct).to.equal('direct');
    });

    it('should skip binding function keys named bindAws', () => {
      let testAws = false;
      let called = false;
      const verboseApi = {
        test: (aws) => {
          testAws = aws ? true : false;
        },
        bindAws: () => { called = true; }};
      const api = common.bindAws(aws, verboseApi);
      api.bindAws(aws, verboseApi);
      expect(testAws).to.equal(false);
      expect(called).to.equal(true);
    });
  });
});
