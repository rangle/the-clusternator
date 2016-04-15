const Q = require('q');
const rewire = require('rewire');

const ci = rewire('./container-instances');
const C = require('../../chai');
const checkAsync = C.checkAsync;

const aws = {};

const CALLED = {
  registerContainerInstance: 'registerContainerInstance',
  describeContainerInstances: 'describeContainerInstances',
  deregisterContainerInstance: 'deleted',
};

function initData() {
  aws.ecs = {
    registerContainerInstance: () => Q.resolve(
      {containerInstance: CALLED.registerContainerInstance}),
    describeContainerInstances: () => Q.resolve(
      {containerInstances: [CALLED.describeContainerInstances]}),
    deregisterContainerInstance: () => Q.resolve(true),
    listContainerInstances: () => Q.resolve(
      {containerInstanceArns:
        ['/clusternator-pid-my-project--deployment-master--pr-5']}),
  };
}

/*global describe, it, expect, beforeEach, afterEach */
describe('AWS: ECS: Container Instances', () => {
  
  beforeEach(initData);

  describe('create function', () => {
    it('should call ecs.registerContainerInstance', checkAsync(
      ci.helpers.create(aws, 'mycluster', 'mycontainerinstance'),
      (r) => expect(r).to.equal(CALLED.registerContainerInstance)
    ));

    it('should throw without clusterArn', () => {
      expect(() => ci.helpers.create(aws, null))
        .to.throw(TypeError);
    });
  });

  describe('findOrCreate function', () => {
    it('should return found container instance', checkAsync(
      ci.create(aws, 'mycluster', 'mycontainerinstance'),
      (r) => expect(r).to.equal(CALLED.describeContainerInstances)
    ));

    it('should create new container instance when none exist', checkAsync(
      () => {
        aws.ecs.describeContainerInstances = () =>
          Q.resolve({containerInstances: []});
        return ci.create(aws, 'mycluster', 'mycontainerinstance')();
      },
      (r) => expect(r).to.equal(CALLED.registerContainerInstance)
    ));
  });

  describe('describe function', () => {
    it('should call ecs.describeContainerInstances', checkAsync(
      ci.describe(aws, 'mycontainerinstance'),
      (r) => expect(r[0])
        .to.equal(CALLED.describeContainerInstances)
    ));

    it('should throw without clusterArn', () => {
      expect(() => ci.describe(aws, null))
        .to.throw(TypeError);
    });
  });

  describe('destroy function', () => {
    it('should call ecs.deregisterContainerInstance', checkAsync(
      ci.helpers.destroy(aws, 'mycluster', 'mycontainerinstance'),
      (r) => expect(r).to.equal(CALLED.deregisterContainerInstance)
    ));

    it('should throw without clusterArn', () => {
      expect(() => ci.helpers.destroy(aws, null, 'mycontainerinstance'))
        .to.throw(TypeError);
    });

    it('should throw without clusterArn', () => {
      expect(() => ci.helpers.destroy(aws, 'mycluster', null))
        .to.throw(TypeError);
    });
  });

  describe('findAndDestroy function', () => {
    it('should destroy container instance when found', checkAsync(
      ci.destroy(aws, 'mycluster', 'mycontainerinstance'),
      (r) => expect(r).to.equal(CALLED.deregisterContainerInstance)
    ));

    it('should do nothing when instance not found', checkAsync(
      () => {
        aws.ecs.describeContainerInstances = () =>
          Q.resolve({containerInstances: []});
        return ci.destroy(aws, 'mycluster', 'mycontainerinstance')();
      },
      (r) => expect(r).to.equal('already deleted')
    ));
  });

  describe('list function', () => {
    it('should call ecs.listContainInstances', checkAsync(
      ci.list(aws, 'mycluster'),
      (r) => expect(r).to.have.length(1)
    ));

    it('should throw without clusterArn', () => {
      expect(() => ci.list(aws, null))
        .to.throw(TypeError);
    });
  });
});
