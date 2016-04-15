const Q = require('q');
const rewire = require('rewire');

const ts = rewire('./task-services');
const C = require('../../chai');
const checkAsync = C.checkAsync;

const aws = {};

const CALLED = {
  createService: 'createService',
  deleteService: 'deleted',
};

function initData() {
  aws.ecs = {
    createService: () => Q.resolve({service: CALLED.createService}),
    describeServices: () => Q.resolve(
      {services: [{taskDefinition: 'mytaskdef'}]}),
    deleteService: () => Q.resolve(true),
    listServices: () => Q.resolve({serviceArns: ['myservice']}),
    updateService: (updateObj) => Q.resolve({service: updateObj}),

    registerTaskDefinition: () => Q.resolve(
      {taskDefinition: {taskDefinitionArn: true}})
  };
}

/*global describe, it, expect, beforeEach, afterEach */
describe('AWS: ECS: Task Services', () => {
  
  beforeEach(initData);

  describe('create function', () => {
    it('should call ecs.createService', checkAsync(
      ts.helpers.create(aws, 'mycluster', 'myservice', 'mytaskdef'),
      (r) => expect(r).to.equal(CALLED.createService)
    ));

    it('should throw without clusterArn', () => {
      expect(
        () => ts.helpers.create(aws, null, 'myservice', {taskDefinition: {}})
      ).to.throw(TypeError);
    });

    it('should throw without serviceArn', () => {
      expect(
        () => ts.helpers.create(aws, 'mycluster', null, {taskDefinition: {}})
      ).to.throw(TypeError);
    });

    it('should throw without taskDef', () => {
      expect(() => ts.helpers.create(aws, 'mycluster', 'myservice', null))
        .to.throw(TypeError);
    });
  });

  describe('findOrCreate function', () => {
    it('should return found service', checkAsync(
      ts.create(aws, 'mycluster', 'myservice', 'mytaskdef'),
      (r) => expect(r).to.deep.equal({taskDefinition: 'mytaskdef'})
    ));

    it('should create new service when none exist', checkAsync(
      () => {
        aws.ecs.describeServices = () => Q.resolve({services: []});
        return ts.create(aws, 'mycluster', 'myservice', 'mytaskdef')();
      },
      (r) => expect(r).to.equal(CALLED.createService)
    ));
  });

  describe('checkForInactive', () => {
    it('should return true if service is inactive', () => {
      const isInactive = ts.helpers
        .checkForInactive([{status: 'INACTIVE'}]);
      expect(isInactive).to.be.true;
    });

    it('should return false if service is active', () => {
      const isInactive = ts.helpers
        .checkForInactive([{status: 'SOMETHING_ELSE'}]);
      expect(isInactive).to.be.false;
    }); 
  });

  // describe('createTaskAndService function', () => {
  //   it('should throw without clusterArn', () => {
  //     expect(() => ts.createTaskAndService(aws, null, 'myservice', {}))
  //       .to.throw(TypeError);
  //   });

  //   it('should throw without serviceName', () => {
  //     expect(() => ts.createTaskAndService(aws, 'mycluster', null, {}))
  //       .to.throw(TypeError);
  //   });

  //   it('should throw without task', () => {
      // expect(() => ts
      //   .createTaskAndService(aws, 'mycluster', 'myservice', null))
  //       .to.throw(TypeError);
  //   });
  // });

  // describe('createTasksAndServices function', () => {
  //   it('should throw without clusterArn', () => {
  //     expect(() => ts
  //         .createTasksAndServices(aws, null, 'myservice', {tasks: []}))
  //       .to.throw(TypeError);
  //   });

  //   it('should throw without serviceName', () => {
  //     expect(() => ts
  //         .createTasksAndServices(aws, 'mycluster', null, {tasks: []}))
  //       .to.throw(TypeError);
  //   });

  //   it('should throw without appDef', () => {
  //     expect(() => ts
  //         .createTasksAndServices(aws, 'mycluster', 'myservice', null))
  //       .to.throw(TypeError);
  //   });
  // });

  describe('describe function', () => {
    it('should call ecs.listServices, followed by ecs.describeServices',
      checkAsync(
        ts.describe(aws, 'mycluster'),
        (r) => expect(r).to.deep.equal([{taskDefinition: 'mytaskdef'}])
      )
    );

    it('should throw without clusterArn', () => {
      expect(() => ts.describe(aws, null))
        .to.throw(TypeError);
    });
  });

  describe('describeMany function', () => {
    it('should call ecs.describeServices', checkAsync(
      ts.describeMany(aws, 'mycluster', ['myservice']),
      (r) => expect(r).to.deep.equal([{taskDefinition: 'mytaskdef'}])
    ));

    it('should throw without clusterArn', () => {
      expect(() => ts.describeMany(aws, null, ['myservice']))
        .to.throw(TypeError);
    });

    it('should throw without serviceArns', () => {
      expect(() => ts.describeMany(aws, 'mycluster', []))
        .to.throw(TypeError);
    });
  });

  describe('destroy function', () => {
    it('should call ecs.deleteService', checkAsync(
      ts.helpers.destroy(aws, 'mycluster', 'myservice'),
      (r) => expect(r).to.equal(CALLED.deleteService)
    ));

    it('should throw without clusterArn', () => {
      expect(() => ts.helpers.destroy(aws, null, 'myservice'))
        .to.throw(TypeError);
    });

    it('should throw without serviceArn', () => {
      expect(() => ts.helpers.destroy(aws, 'mycluster', null))
        .to.throw(TypeError);
    });
  });

  describe('getStatus function', () => {
    it('should return -1 without arguments', () => {
      const status = ts.helpers.getStatus();
      expect(status).to.equal(-1);
    });

    it('should return 0 when service has steady state event ', () => {
      const service = {
        events: [{message: 'steady state'}]
      };

      const status = ts.helpers.getStatus([service]);
      expect(status).to.equal(0);
    });

    it('should return 1 when service has no steady state event', () => {
      const service = {
        events: [{message: ''}]
      };

      const status = ts.helpers.getStatus([service]);
      expect(status).to.equal(1);
    });
  });

  describe('list function', () => {
    it('should call ecs.listServices', checkAsync(
      ts.list(aws, 'mycluster'),
      (r) => expect(r).to.be.ok
    ));

    it('should throw without clusterArn', () => {
      expect(() => ts.list(aws, null))
        .to.throw(TypeError);
    });
  });

  describe('processDescription function', () => {
    it('should process a service object', () => {
      const service = {
        serviceArn: 'myservice',
        clusterArn: 'mycluster',
        youshouldnt: 'see this',
        events: [{message: ''}]
      };
      const processed = {
        serviceArn: 'myservice',
        lastEvent: ''
      };
      expect(ts.helpers.processDescription(service))
        .to.deep.equal(processed);
    });
  });

  describe('processDescriptions function', () => {
    it('should process array of service objects', () => {
      const service = {
        serviceArn: 'myservice',
        clusterArn: 'mycluster',
        youshouldnt: 'see this',
        events: [{message: ''}]
      };
      const processed = {
        serviceArn: 'myservice',
        lastEvent: ''
      };
      expect(ts.helpers.processDescriptions([service]))
        .to.deep.equal([processed]);
    });
  });

  describe('stop function', () => {
    it('should update service with desiredCount = 0', checkAsync(
      ts.stop(aws, 'mycluster', 'myservice'),
      (r) => expect(r).to.have.property('desiredCount', 0)
    ));

    it('should throw without clusterArn', () => {
      expect(() => ts.stop(aws, null, 'myservice'))
        .to.throw(TypeError);
    });

    it('should throw without serviceArn', () => {
      expect(() => ts.stop(aws, 'mycluster', null))
        .to.throw(TypeError);
    });
  });

  // describe('stopAndDestroy function', () => {
  //   it('should stop, then destroy service', () => {
      
  //   });
  // });

  // describe('stopAndDestroyCluster function', () => {
  //   it('should stop, then destroy service in cluster', () => {
      
  //   });
  // });

  // describe('waitForDrained function', () => {
  //   it('should ')
  // });

  // describe('waitForReady function', () => {
    
  // });

  describe('update function', () => {
    it('should update service with updateObj', checkAsync(
      ts.update(aws, 'mycluster', 'myservice', {stuff: 1}),
      (r) => expect(r).to.deep.equal({
          cluster: 'mycluster',
          service: 'myservice',
          stuff: 1
        })
    ));

    it('should throw without clusterArn', () => {
      expect(() => ts.update(aws, null, 'myservice', {}))
        .to.throw(TypeError);
    });

    it('should throw without serviceArn', () => {
      expect(() => ts.update(aws, 'mycluster', null, {}))
        .to.throw(TypeError);
    });

    it('should throw without updateObj', () => {
      expect(() => ts.update(aws, 'mycluster', 'myservice', null))
        .to.throw(TypeError);
    });
  });
});
