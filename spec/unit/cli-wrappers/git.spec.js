'use strict';

var rewire = require('rewire'),
  Q = require('q');

var git = rewire('../../../src/cli-wrappers/git'),
  C = require('./../chai');

/*global describe, it, expect, beforeEach, afterEach */
/*eslint no-unused-expressions:0*/
describe('Test git CLI Wrapper', () => {
  var projectRoot = '/', cProc, workDir;

  beforeEach(() => {
    workDir = process.cwd();
    projectRoot = '/';
    cProc = git.__get__('cproc');
    git.__set__('cproc', {output: Q.resolve, stream: Q.resolve});
  });

  afterEach(() => {
    process.chdir(workDir);
    git.__set__('cproc', cProc);
  });


  it('shaHead should resolve if there are no exit errors', (done) => {
    git.shaHead().then(() => C
      .check(done, () => expect(true).to.be.ok))
      .fail(C.getFail(done));
  });

  it('clone should resolve if there are no exit errors', (done) => {
    git.clone('some-repo').then(() => C
      .check(done, () => expect(true).to.be.ok ))
      .fail(C.getFail(done));
  });

  it('clonse should throw if not given a repo', () => {
    expect(() => {
      git.clone();
    }).to.throw(TypeError);
  });

  it('genSha should resolve if there are no exit errors', (done) => {
    git
      .checkout('path/to/thing')
      .then(() =>
        C.check(done, () => expect(true).to.be.ok))
      .fail(C.getFail(done));
  });

  it('cloneRepoFromDir should resolve if there are no exit errors', (done) => {
    git
      .helpers
      .cloneRepoInDir('repo', require('os').tmpdir())
      .then(() =>
        C.check(done, () => expect(true).to.be.ok))
      .fail(C.getFail(done));
  });

  it('checkoutIdentifierFromDir should resolve if there are no exit errors',
    (done) => {
      git
      .helpers
      .checkoutIdentifierFromDir('id', require('os').tmpdir())
      .then(() =>
        C.check(done, () => expect(true).to.be.ok))
      .fail(C.getFail(done));
  });

  it('genSha should throw if given no tag', () => {
    expect(() => git.checkout()).to.throw(Error);
  });

  it('getShortRepoName should return the name portion of a uri', () => {
    expect(git.helpers.getShortRepoName('blah/bha/hello.git'))
      .to.equal('hello');
  });

  it('destroy should always resolve', (done) => {
    git
      .destroy('some randome temp object')
      .then(() => C
        .check(done, () => expect(true).to.be.ok))
      .fail(C.getFail(done));
  });
});
