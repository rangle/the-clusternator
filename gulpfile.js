'use strict';

var gulp = require('gulp');
var babel = require('gulp-babel');
var eslint = require('gulp-eslint');
var exit = require('gulp-exit');
var mocha = require('gulp-mocha');
var plumber = require('gulp-plumber');
var istanbul = require('gulp-istanbul');
var gutil = require('gulp-util');
var spawn = require('child_process').spawn;

var jsPaths = ['src/**/*.js', 'src/*.js'];
var cliPath = ['bin-src/**/*.js'];
var specPaths = ['src/aws/ec2/vpc.spec.js', 'src/aws/ec2/route-table.spec.js'];

gulp.task('default', ['transpile']);
gulp.task('test', ['test-unit']);

/**
 * Builds JSDoc documentation from source
 */
gulp.task('jsdoc', function jsDoc() {
  // Finally execute your script below - here 'ls -lA'
  var child = spawn('npm', ['run', 'doc-api'], {cwd: process.cwd()});

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

/**
 * transpiles to es5
 */
gulp.task('transpile', ['transpile-cli', 'transpile-src']);

/**
 * transpiles the CLI entry point only
 */
gulp.task('transpile-cli', function transpileCli() {
  return gulp.src(cliPath)
    .pipe(babel())
    .pipe(gulp.dest('bin'));
});

/**
 * transpiles the main source
 */
gulp.task('transpile-src', function transpileSrc() {
  return gulp.src(jsPaths)
    .pipe(plumber())
    .pipe(babel())
    .pipe(gulp.dest('lib'));
});

/**
 * transpiles and builds docs on change
 */
gulp.task('watch', function watch() {
  gulp.watch(jsPaths, ['transpile', 'jsdoc']);
});

/**
 * transpiles on change
 */
gulp.task('watch-quick', function watchQuick() {
  gulp.watch(jsPaths, ['transpile']);
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
// gulp.task('test-unit', ['lint', 'pre-test-unit'], function testUnit() {
gulp.task('test-unit', function testUnit() {
  return gulp
    .src(specPaths)
    .pipe(mocha())
    // .pipe(istanbul.writeReports({
    //   reporters: ['text', 'lcovonly', 'html', 'json', 'text-summary'],
    //   reportOpts: {
    //     dir: './coverage',
    //     lcov: {
    //       dir: 'coverage/lcovonly',
    //       file: 'lcov.info'
    //     },
    //     html: {
    //       dir: 'coverage/html'
    //     },
    //     json: {
    //       dir: 'coverage/json'
    //     }
    //   }
    // }))
    // .pipe(istanbul.enforceThresholds({ thresholds: {
    //   global: {
    //     statements: 70,
    //     branches: 45
    //   }
    // } }))
    ;
});

/**
 * lints the source
 */
gulp.task('lint', function lint() {
  return gulp.src(jsPaths.concat(specPaths))
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});
