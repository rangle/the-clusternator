'use strict';

const Q = require('q');
const rewire = require('rewire');

const vme = rewire('./vm-ecs');
const C = require('../../../chai');

const aws = {};
const vm = {};
const tag = {};


/*global describe, it, expect, beforeEach, afterEach */
describe('AWS: EC2: VM-ECS (ec2 virtual machines for ECS hosting)', () => {
  let oldVm;
  let oldTag;
  
  function initData() {
    oldVm = vme.__get__('vm');
    vme.__set__('vm', vm);
    oldTag = vme.__get__('tag');
    vme.__set__('tag', tag);
    vm.create = () => () => Q.resolve(['create-id']);
    vm.list = () => () => Q.resolve([]);
    tag.tag = () => () => Q.resolve('tag');
    tag.unTag = () => () => Q.resolve('untag');
    tag.createClusternator = () => {};
    tag.createDeployment = () => {};
    tag.createExpires = () => {};
    tag.createName = () => {};
    tag.createProject = () => {};
    tag.createPr = () => {};
  }
  
  function cleanData() {
    vme.__set__('vm', oldVm);
    vme.__set__('tag', oldTag);
  }

  beforeEach(initData);
  afterEach(cleanData);

  describe('addTags function', () => {
    it('should return a function', () => {
      expect(typeof vme.addTags(aws, ['instanceId'], [], 'testing addTags'));
    }); 
  });
  
  describe('removeTags function', () => {
    it('should return a function', () => {
      expect(typeof vme
        .removeTags(aws, ['instanceId'], [], 'testing removeTags'));
    });
  });

  describe('create function', () => {
    it('should return a function', () => {
      expect(typeof vme.create(
        aws, 
        'sgId', 
        'subnetId', 
        [], 
        'base64 user data')
      ).to.equal('function');
    });
    
    it('s returned function should return a promise', () => {
      const p = vme.create(
        aws,
        'sgId',
        'subnetId',
        [],
        'base64 user data')();
      expect(typeof p.then).to.equal('function');
    });
  });

  describe('createDeployment function', () => {
    it('should return a function', () => {
      const f = vme.createDeployment(aws, 'clusterName', 'projectId', 'master', 
        'sgId', 'subnetId', ['ssh-public-keys']);
      expect(typeof f).to.equal('function');
    });

    it('should return a function that promises to return a list of ' +
      'deployments, if deployments are listed', (done) => {
      let count = 0;
      vm.listDeployment = () => () => { 
        count += 1; 
        return Q.resolve(['deploymendId']); 
      };
      const f = vme.createDeployment(aws, 'clusterName', 'projectId', 'master',
        'sgId', 'subnetId', ['ssh-public-keys']);
      
      f()
        .then(() => C.check(done, () => expect(count).to.equal(1)))
        .fail(C.getFail(done));
    });

    describe('create case', () => {
      let oldCreate;
      let callCount;
      
      beforeEach(() => {
        callCount = 0;
        oldCreate = vme.__get__('create'); 
        vme.__set__('create', () => () => { 
          callCount += 1; return Q.resolve(true); 
        });
      });
      
      afterEach(() => {
        vme.__set__('create', oldCreate); 
      });
      
      it('should return a function that promises to create a deployment, if ' +
        'deployments are not found', (done) => {
        vm.listDeployment = () => () => Q.resolve([]);
        const f = vme.createDeployment(aws, 'clusterName', 'projectId', 
          'master', 'sgId', 'subnetId', ['ssh-public-keys']);

        f()
          .then(() => C.check(done, () => expect(callCount).to.equal(1)))
          .fail(C.getFail(done));
      });
    });
  });

  describe('createPr function', () => {
    it('should return a function', () => {
      const f = vme.createPr(aws, 'clusterName', 'projectId', 'master',
        'sgId', 'subnetId', ['ssh-public-keys']);
      expect(typeof f).to.equal('function');
    });

    it('should return a function that promises to return a list of ' +
      'deployments, if deployments are listed', (done) => {
      let count = 0;
      vm.listPr = () => () => {
        count += 1;
        return Q.resolve(['prId']);
      };
      const f = vme.createPr(aws, 'clusterName', 'projectId', '321', 'sgId', 
        'subnetId', ['ssh-public-keys']);

      f()
        .then(() => C.check(done, () => expect(count).to.equal(1)))
        .fail(C.getFail(done));
    });

    describe('create case', () => {
      let oldCreate;
      let callCount;

      beforeEach(() => {
        callCount = 0;
        oldCreate = vme.__get__('create');
        vme.__set__('create', () => () => {
          callCount += 1; return Q.resolve(true);
        });
      });

      afterEach(() => {
        vme.__set__('create', oldCreate);
      });

      it('should return a function that promises to create a deployment, if ' +
        'deployments are not found', (done) => {
        vm.listPr = () => () => Q.resolve([]);
        const f = vme.createPr(aws, 'clusterName', 'projectId', '123', 'sgId', 
          'subnetId', ['ssh-public-keys']);

        f()
          .then(() => C.check(done, () => expect(callCount).to.equal(1)))
          .fail(C.getFail(done));
      });
    });
  });
  
  describe('bindAws function', () => {
    it('should return a copy of the api', () => {
      expect(vme.bindAws(aws)).to.be.ok;
    });
  });

  describe('stageDeployment', () => {
    it('should return a function', () => {
      expect(typeof vme.stageDeployment(aws, 'deployment', ['instanceId']))
        .to.equal('function');
    });
    
    it('s result function should return a promise', () => {
      const p = vme.stageDeployment(aws, 'deployment', ['instanceId'])();
      expect(typeof p.then).to.equal('function');
    });
  });
  
  describe('unStageDeployment', () => {
    it('should return a function', () => {
      expect(typeof vme.unStageDeployment(aws, 'project', 'master'))
        .to.equal('function');
    });
    
    it('s result function should return a promise', () => {
      const p = vme.unStageDeployment(aws, 'project', 'master')(); 
      expect(typeof p.then).to.equal('function');
    });
  });
  
  describe('stagePr', () => {
    it('should return a function', () => {
      expect(typeof vme.stagePr(aws, '555', ['instanceId']))
        .to.equal('function');
    });
    
    it('s result function should return a promise', () => {
      const p = vme.stagePr(aws, '555', ['instanceId'])();
      expect(typeof p.then).to.equal('function');
    });
  });

  describe('unStagePr', () => {
    it('should return a function', () => {
      expect(typeof vme.unStagePr(aws, 'project', '555'))
        .to.equal('function');
    });
    
    it('s result function should return a promise', () => {
      const p = vme.unStagePr(aws, 'project', '555')();
      expect(typeof p.then).to.equal('function');
    });
  });
  
});
