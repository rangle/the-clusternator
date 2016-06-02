'use strict';

const rewire = require('rewire');
const Q = require('q');
const mockFs = require('mock-fs');

const cn = rewire('./clusternator-json');
const fs = rewire('./project-fs');
const C = require('../../../chai');

/*global describe, it, expect, beforeEach, afterEach */
describe('clusternator.json handling', () => {
  let project;
  let other;
  let oldGit;
  let oldInq;
  let mockGitResponse;
  let workDir;

  function mockGit() {
    if (mockGitResponse instanceof Error) {
      return Q.reject(mockGitResponse);
    }
    return Q.resolve(mockGitResponse);
  }

  beforeEach(() => {
    workDir = process.cwd();
    project = 'home/user/workspaces/rangle/the-clusternator';
    other = 'home/user/workspaces/rangle/some-project/src';
    oldGit = cn.__get__('git');
    oldInq = cn.__get__('util');
    cn.__set__('git', mockGit);

    cn.__set__('util.inquirerPrompt', () => Q.resolve({ private: ''}) );

    mockFs({
      'home/user/workspaces/rangle/the-clusternator': {
        '.git': {
          'config': new Buffer([1, 2, 5])
        },
        'clusternator.json': new Buffer([ 1 ]),
        src: {
          components: {
          }
        }
      },
      'home/user/workspaces/rangle/the-clusternator/src/component': {},
      'home/user/workspaces/rangle/some-project/': {
        'src': {}
      },
      'home/user/workspaces/other': {}
    });
  });

  afterEach(() => {
    process.chdir(workDir);
    mockFs.restore();
    cn.__set__('git', oldGit);
    cn.__set__('util.inquirerPrompt', oldInq);
  });

  it('parent should return the full path to a parent folder', () => {
    expect(fs.helpers.parent('/a/b')).to.equal('/a');
  });

  it('parent should return the relative path to a parent folder', () => {
    expect(fs.helpers.parent('a/b')).to.equal('a');
  });

  it('parent should return falsey if the path is root', () => {
    expect(fs.helpers.parent('/a/')).to.not.be;
  });

  it('findProjectRoot should resolve the cwd if it has a .git folder in it',
    (done) => {
      fs.findProjectRoot(project).then((root) => {
        C.check(done, () => {
          expect(root).to.equal(project);
        });
      }, C.getFail(done));
    });

  it('findProjectRoot should resolve the project root from a sub directory',
    (done) => {
      fs.findProjectRoot(project + '/src/components/').then((root) => {
        C.check(done, () => {
          expect(root).to.equal(project);
        });
      }, C.getFail(done));
    });

  it('findProjectRoot should reject if it cannot find a .git folder in the ' +
    'parent directories ', (done) => {
    fs.findProjectRoot(other).then(C.getFail(done), (err) => {
      C.check(done, () => {
        expect(err instanceof Error).to.be.ok;
      });
    }, C.getFail(done));
  });

  it('parseGitUrl should return the last part of the git url', () => {
    expect(cn.helpers.parseGitUrl(
      'https://github.com/rangle/the-clusternator'))
      .to.equal('the-clusternator');
  });

  it('paseGitUrl should return the last part of the git url *without* the ' +
    '.git', () => {
    expect(cn.helpers.parseGitUrl(
      'https://github.com/rangle/the-clusternator.git'))
      .to.equal('the-clusternator');
  });

  it('findGitName should reject if given an unexpected object', (done) => {
    mockGitResponse = {};
    cn.helpers.findGitName('some/path').then(C.getFail(done), (err) => {
      C.check(done, () => {
          expect(err instanceof Error).to.be.true;
      });
    });
  });

  it('findGitName should resolve if given an expected object', (done) => {
    mockGitResponse = { 'remote "origin"': {
      url: 'ssh://path/to/project.git' }};
    cn.helpers.findGitName('some/path').then((name) => {
      C.check(done, () => {
        expect(name).to.equal('project');
      });
    }, C.getFail(done));
  });

  it('deDupe should remove duplicates, and falseys from an array of strings',
    () => {
      const tryMe = ['a', 'a', '', '', '', 'b', 'c','d','e','e','e'];
      expect(cn.helpers.deDupe(tryMe).toString())
        .to.equal(['a', 'b', 'c', 'd', 'e'].toString());
    });

  it('findPackageName should return falsey if package.json cannot be parsed',
    () => {
      expect(cn.helpers.findPackageName('a')).to.not.be.ok;
    });

  it('findBowerName should return falsey if bower.json cannot be parsed',
    () => {
      expect(cn.helpers.findBowerName('a')).to.not.be.ok;
    });

  it('findProjectNames should resolve an array of strings', (done) => {
    cn.findProjectNames('some/path').then((results) => {
      C.check(done, () => {
        expect(Array.isArray(results)).to.be.ok;
      });
    }, C.getFail(done));
  });

  it('findProjectNames should resolve an array of strings if gitName search ' +
    'fails', (done) => {
    mockGitResponse = new Error('git fail!');
    cn.findProjectNames('some/path').then((results) => {
      C.check(done, () => {
        expect(Array.isArray(results)).to.be.ok;
      });
    }, C.getFail(done));
  });

  it('validate should return an object with specifics about exactly what is ' +
    'invalid', () => {
    expect(cn.validate({}).projectId).to.be.ok;
  });

  it('validate should return an object *without* an "ok" boolean if the ' +
    'structure is not okay', () => {
    expect(cn.validate({ appDefs: {} }).ok).to.not.be.ok;
  });

  it('validate should return an object with an "ok" boolean if the structure ' +
    'is valid', () => {
    expect(cn.validate({
      projectId: 'test-project',
      appDefs: {
        pr: 'path/to/appDef'
      }
    }).ok).to.be.ok;
  });

  it('createInteractive should return a resolving promise', (done) => {
    cn.createInteractive().then(() => {
      C.check(done, () => {
        expect(true).to.be.ok;
      });
    }, C.getFail(done));
  });

  it('answersToClusternatorJSON should return a string if given the correct ' +
    'arguments', () => {
    expect(typeof cn.helpers.answersToClusternatorJSON(
      { projectId: 'test', appDefPr: 'hi'})).to.equal('string');
  });

  it('skipIfExists should resolve if a clusternator.json file does not exist',
    (done) => {
      cn.skipIfExists('/some/fake/path').then(() => {
        C.check(done, () => {
          expect(true).to.be.ok;
        });
      }, C.getFail(done));
    });

/* TODO: figure out what's up with this test.
  it('skipIfExists should reject if a clusternator.json file exists',
    (done) => {
      cn.skipIfExists(project).then(C.getFail(done), (err) => {
        C.check(done, () => {
          expect(err instanceof Error).to.be.ok;
        });
      });
    });
*/

  it('writeFromAnswers should return a promise', () => {
    expect(typeof cn
      .writeFromAnswers({ projectId: '', appDefPr: '', root: '/' })
      .then).to.equal('function');
  });
});

describe('ignore file tests', () => {
  let projectRoot = '/';
  let oldFindRoot;

  /*global describe, it, expect, beforeEach, afterEach */
  /*eslint no-unused-expressions:0*/
  beforeEach(() => {
    projectRoot = '/';
    oldFindRoot = fs.__get__('findProjectRoot');
    fs.__set__('findProjectRoot', () => Q.resolve(projectRoot) );
    mockFs({
      '.git': {
        'config': new Buffer([1, 2, 5])
      },
      '.gitignore':  new Buffer([1, 2, 3])
    });
  });

  afterEach(() => {
    fs.__set__('findProjectRoot', oldFindRoot);
    mockFs.restore();
  });

  it('ignoreHasItem should return true if a string *starts* a line in an' +
    ' array of strings', () => {
    expect(
      cn.helpers.ignoreHasItem('test', ['a', 'b', 'c', 'test235', 'd'])
    ).to.be.ok;
  });

  it('ignoreHasItem should return false if no strings are found', () => {
    expect(
      cn.helpers.ignoreHasItem('test', ['a', 'b', 'c', '23test', 'd'])
    ).to.not.be.ok;
  });

  it('readIgnoreFile should resolve an array of strings', (done) => {
    cn.helpers.readIgnoreFile('.gitignore').then((result) => {
      C.check(done, () => {
        expect(Array.isArray(result)).to.be.ok;
        expect(typeof result[0]).to.equal('string');
      });
    }, C.getFail(done));
  });

  it('readIgnoreFile should resolve even if there is not .gitignore',
    (done) => {
      projectRoot = 'some/invalid/path';
      cn.helpers.readIgnoreFile('.gitignore').then((result) => {
        C.check(done, () => {
          expect(Array.isArray(result)).to.be.ok;
        });
      }, C.getFail(done));
    });

  // not playing nicely with new fs system
  //it('addToIgnore should add a *new* entry to the .gitignore file',
  //  (done) => {
  //    cn.addToIgnore('.gitignore', 'someFile').then(() => {
  //      fs.readFile('.gitignore', 'utf8', (err, file) => {
  //        if (err) {
  //          C.getFail(done)(err);
  //          return;
  //        }
  //        var ignores = file.split('\n');
  //        C.check(done, () => {
  //          expect(cn.helpers.ignoreHasItem('someFile', ignores))
  //            .to.be.ok;
  //        });
  //      });
  //    }, C.getFail(done));
  //  });

  it('addToIgnore should resolve if an entry already exists',
    (done) => {
      cn.addToIgnore('.gitignore', 'someFile').then(() => {
        return cn.addToIgnore('.gitignore', 'someFile').then(() => {
          C.check(done, () => {
            expect(true).to.be.ok;
          });
        });
      }, C.getFail(done));
    });
});
