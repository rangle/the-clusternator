'use strict';

const Q = require('q');
const rewire = require('rewire');

const td = rewire('./task-definitions');
const C = require('../../chai');
const checkAsync = C.checkAsync;

const aws = {};

const CALLED = {
  registerTaskDefinition: 'registerTaskDefinition',
  deregisterTaskDefinition: 'deleted',
  describeTaskDefinition: 'describeTaskDefinition',
  listTaskDefinitionFamilies: 'listTaskDefinitionFamilies',
};

function initData() {
  aws.ecs = {
    registerTaskDefinition: () => Q.resolve(
      {taskDefinition: CALLED.registerTaskDefinition}),
    describeTaskDefinition: () => Q.resolve(
      {taskDefinition: CALLED.describeTaskDefinition}),
    deregisterTaskDefinition: () => Q.resolve(true),
    listTaskDefinitions: () => Q.resolve(
      {taskDefinitionArns: [
        '/clusternator-resource',
        '/clusternator-pid-my-project--pr-5--deployment-master'
      ]}),
    listTaskDefinitionFamilies: () => Q.resolve(
      {families: CALLED.listTaskDefinitionFamilies}),
  };
}

/*global describe, it, expect, beforeEach, afterEach */
describe('AWS: ECS: Task Definitions', () => {

  beforeEach(initData);

  describe('create function', () => {
    it('should call ecs.registerTaskDefinition', checkAsync(
      td.create(aws, {taskDefinition: {}}),
      (r) => expect(r).to.equal(CALLED.registerTaskDefinition)
    ));

    it('should throw without taskDef param', () => {
      expect(() => td.create(aws, null)).to.throw(TypeError);
    });
  });

  describe('describeOne function', () => {
    it('should call ecs.describeTaskDefinition', checkAsync(
      td.describeOne(aws, {taskDefinition: true}),
      (r) => expect(r).to.equal(CALLED.describeTaskDefinition)
    ));

    it('should throw without taskDef param', () => {
      expect(() => td.describeOne(aws, null)).to.throw(TypeError);
    });
  });

  describe('destroy function', () => {
    it('should call ecs.deregisterTaskDefinition', checkAsync(
      td.helpers.destroy(aws, {taskDefinition: true}),
      (r) => expect(r).to.equal(CALLED.deregisterTaskDefinition)
    ));

    it('should throw without taskDef', () => {
      expect(() => td.helpers.destroy(aws, null)).to.throw(TypeError);
    });
  });

  describe('findAndDestroy function', () => {
    it('should destroy taskDefinition when found', checkAsync(
      td.destroy(aws, {taskDefinition: true}),
      (r) => expect(r).to.equal(CALLED.deregisterTaskDefinition)
    ));

    it('should destroy taskDefinition when found', checkAsync(
      () => {
        aws.ecs.describeTaskDefinition = () =>
          Q.resolve({taskDefinition: false});
        return td.destroy(aws, {taskDefinition: true})();
      },
      (r) => expect(r).to.equal('already deleted')
    ));
  });

  describe('list function', () => {
    it('should call ecs.listTaskDefinitions', checkAsync(
      td.list(aws),
      (r) => expect(r).to.have.length(2)
    ));
  });

  describe('listFamilies function', () => {
    it('should call ecs.listTaskDefinitionFamilies', checkAsync(
      td.listFamilies(aws),
      (r) => expect(r).to.equal(CALLED.listTaskDefinitionFamilies)
    ));
  });

  describe('listProject function', () => {
    it('should list task definitions belonging to projectId', checkAsync(
      td.listProject(aws, 'my-project'),
      (r) => expect(r).to.have.length(1)
    ));

    it('should throw without projectId param', () => {
      expect(() => td.listProject(aws, null)).to.throw(TypeError);
    });
  });

  describe('listPr function', () => {
    it('should list task definitions belonging to pr', checkAsync(
      td.listPr(aws, 'my-project', '5'),
      (r) => expect(r).to.have.length(1)
    ));

    it('should throw without projectId param', () => {
      expect(() => td.listPr(aws, null, '5')).to.throw(TypeError);
    });

    it('should throw without pr param', () => {
      expect(() => td.listPr(aws, 'my-projecct', null)).to.throw(TypeError);
    });
  });

  describe('listDeployment function', () => {
    it('should list task definitions belonging to deployment', checkAsync(
      td.listDeployment(aws, 'my-project', 'master'),
      (r) => expect(r).to.have.length(1)
    ));

    it('should throw without projectId param', () => {
      expect(() => td.listDeployment(aws, null, 'master')).to.throw(TypeError);
    });

    it('should throw without projectId param', () => {
      expect(() => td.listDeployment(aws, 'my-project', null))
        .to.throw(TypeError);
    });
  });

});
