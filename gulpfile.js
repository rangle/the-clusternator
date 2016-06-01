'use strict';

const gulp = require('gulp');
const exit = require('gulp-exit');
const mocha = require('gulp-mocha');
const plumber = require('gulp-plumber');
const istanbul = require('gulp-istanbul');
const gutil = require('gulp-util');
const spawn = require('child_process').spawn;

const jsPaths = ['src/**/*.js', 'src/*.js'];
const specPaths = ['src/**/*.spec.js'];

gulp.task('test', ['test-unit']);

/**
 * Builds JSDoc documentation from source
 */
gulp.task('jsdoc', function jsDoc() {
  // Finally execute your script below - here 'ls -lA'
  const child = spawn('npm', ['run', 'doc-api'], {cwd: process.cwd()});

  child.stdout.setEncoding('utf8');

  child.stdout.on('data', function (data) {
    gutil.log(data);
  });

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', function (data) {
    gutil.log(gutil.colors.red(data));
    gutil.beep();
  });

  child.on('close', function(code) {
    gutil.log('Done with JSDoc exit code', code);
  });
});

gulp.task('watch', function watch() {
  gulp.watch(jsPaths, ['jsdoc']);
});

/**
 * re-tests on change
 */
gulp.task('watch-tests', function watchTest() {
  gulp.watch(jsPaths.concat(specPaths), ['test-unit']);
});

/**
 * wires up istanbul
 */
gulp.task('pre-test-unit', function preUnitTest() {
  return gulp
    .src(jsPaths)
    .pipe(istanbul({
      includeUntested: true
    }))
    .pipe(istanbul.hookRequire());
});

/**
 * lints then runs the mocha unit tests
 */
gulp.task('test-unit', ['pre-test-unit'], function testUnit() {
  return gulp
    .src(specPaths)
    .pipe(mocha())
    .pipe(istanbul.writeReports({
      reporters: ['text', 'lcovonly', 'html', 'json', 'text-summary'],
      reportOpts: {
        dir: './coverage',
        lcov: {
          dir: 'coverage/lcovonly',
          file: 'lcov.info'
        },
        html: {
          dir: 'coverage/html'
        },
        json: {
          dir: 'coverage/json'
        }
      }
    }))
    .pipe(istanbul.enforceThresholds({ thresholds: {
      global: {
        statements: 70,
        branches: 45
      }
    } }))
    .pipe(exit());
});
