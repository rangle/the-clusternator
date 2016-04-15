const Q = require('q');
const rewire = require('rewire');

const cl = rewire('./clusters');
const C = require('../../chai');
const checkAsync = C.checkAsync;

const aws = {};

const CALLED = {
  createCluster: 'createCluster',
  deleteCluster: 'deleted',
};

function initData() {
  aws.ecs = {
    createCluster: () => Q.resolve({cluster: CALLED.createCluster}),
    describeClusters: () => Q.resolve(
      {clusters: [{clusterName: 'mycluster'}]}),
    deleteCluster: () => Q.resolve(true),
    listClusters: () => Q.resolve(
      {clusterArns: ['/clusternator-pid-my-project--deployment-master--pr-5']}),

    listServices: () => Q.resolve({serviceArns: ['myservice']}),
    describeServices: () => Q.resolve(
      {services: [{events: [{message: ''}]}]}),
  };
}

/*global describe, it, expect, beforeEach, afterEach */
describe('AWS: ECS: Clusters', () => {
  
  beforeEach(initData);

  describe('create function', () => {
    it('should call ecs.createCluster', checkAsync(
      cl.helpers.create(aws, 'mycluster'),
      (r) => expect(r).to.equal(CALLED.createCluster)
    ));

    it('should throw without clusterName', () => {
      expect(() => cl.helpers.create(aws, null))
        .to.throw(TypeError);
    });
  });

  describe('findOrCreate function', () => {
    it('should return found cluster', checkAsync(
      cl.create(aws, 'mycluster'),
      (r) => expect(r).to.deep.equal({clusterName: 'mycluster'})
    ));

    it('should create new cluster when none existing found', checkAsync(
      () => {
        aws.ecs.describeClusters = () => Q.resolve({clusters: []});
        return cl.create(aws, 'mycluster')();
      },
      (r) => expect(r).to.equal(CALLED.createCluster)
    ));
  });

  describe('describeOne function', () => {
    it('should call ecs.describeClusters', checkAsync(
      cl.describeOne(aws, 'mycluster'),
      (r) => expect(r).to.deep.equal({clusterName: 'mycluster'})
    ));

    it('should throw without clusterName', () => {
      expect(() => cl.describeOne(aws, null))
        .to.throw(TypeError);
    });

    // incorrect way to do async fails
    it('should throw when clusterName is not found', (done) => {
      aws.ecs.describeClusters = () => Q.resolve({clusters: []});
      cl.describeOne(aws, 'notmycluster')()
        .then(() => done(new Error('Did not fail')))
        .fail((err) => done());
    });
  });

  describe('describeDeployment function', () => {
    it('should return clusters in a deployment', checkAsync(
      cl.describeDeployment(aws, 'my-project', 'master'),
      (r) => expect(r).to.deep.equal([[{lastEvent: ''}]])
    ));

    it('should throw without projectId', () => {
      expect(() => cl.describeDeployment(aws, null, 'master'))
        .to.throw(TypeError);
    });

    it('should throw without deployment', () => {
      expect(() => cl.describeDeployment(aws, 'my-project', null))
        .to.throw(TypeError);
    });
  });

  describe('describePr function', () => {
    it('should return clusters in a PR', checkAsync(
      cl.describePr(aws, 'my-project', '5'),
      (r) => expect(r).to.deep.equal([[{lastEvent: ''}]])
    ));

    it('should throw without projectId', () => {
      expect(() => cl.describePr(aws, null, '5'))
        .to.throw(TypeError);
    });

    it('should throw without PR', () => {
      expect(() => cl.describePr(aws, 'my-project', null))
        .to.throw(TypeError);
    });
  });

  describe('describeProject function', () => {
    it('should return clusters in a project', checkAsync(
      cl.describeProject(aws, 'my-project'),
      (r) => expect(r).to.deep.equal([[{lastEvent: ''}]])
    ));

    it('should throw without projectId', () => {
      expect(() => cl.describePr(aws, null))
        .to.throw(TypeError);
    });
  });

  describe('destroy function', () => {
    it('should call ecs.deleteCluster', checkAsync(
      cl.helpers.destroy(aws, 'mycluster'),
      (r) => expect(r).to.equal(CALLED.deleteCluster)
    ));

    it('should throw without projectId', () => {
      expect(() => cl.helpers.destroy(aws, null))
        .to.throw(TypeError);
    });
  });

  describe('findAndDestroy function', () => {
    it('should destroy cluster when found', checkAsync(
      cl.destroy(aws, 'mycluster'),
      (r) => expect(r).to.equal(CALLED.deleteCluster)
    ));

    it('should do nothing when cluster not found', checkAsync(
      () => {
        aws.ecs.describeClusters = () =>
          Q.resolve({clusters: []});
        return cl.destroy(aws, 'mycluster')();
      },
      (r) => expect(r).to.equal('already deleted')
    ));
  });

  describe('list function', () => {
    it('should call ecs.listClusters', checkAsync(
      cl.list(aws),
      (r) => expect(r).to.have.length(1)
    ));
  });

  describe('listDeployment function', () => {
    it('should list clusters belonging to deployment', checkAsync(
      cl.listDeployment(aws, 'my-project', 'master'),
      (r) => expect(r).to.have.length(1)
    ));

    it('should throw without projectId', () => {
      expect(() => cl.listDeployment(aws, null, 'master'))
        .to.throw(TypeError);
    });

    it('should throw without deployment', () => {
      expect(() => cl.listDeployment(aws, 'my-project', null))
        .to.throw(TypeError);
    });
  });

  describe('listPr function', () => {
    it('should list clusters belonging to pr', checkAsync(
      cl.listPr(aws, 'my-project', '5'),
      (r) => expect(r).to.have.length(1)
    ));

    it('should throw without projectId', () => {
      expect(() => cl.listPr(aws, null, '5'))
        .to.throw(TypeError);
    });

    it('should throw without PR', () => {
      expect(() => cl.listPr(aws, 'my-project', null))
        .to.throw(TypeError);
    });
  });

  describe('listProject function', () => {
    it('should list clusters belonging to projectId', checkAsync(
      cl.listProject(aws, 'my-project'),
      (r) => expect(r).to.have.length(1)
    ));

    it('should throw without projectId', () => {
      expect(() => cl.listProject(aws, null))
        .to.throw(TypeError);
    });
  });
});