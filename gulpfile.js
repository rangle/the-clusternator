'use strict';

var gulp = require('gulp'),
  babel = require('gulp-babel'),
  eslint = require('gulp-eslint'),
  mocha = require('gulp-mocha'),
  istanbul = require('gulp-istanbul');

var jsPaths = ['src/**/*.js'],
  cliPath = ['bin-src/**/*.js'],
  specPaths = ['spec/unit/**/*.spec.js'];

gulp.task('default', ['transpile']);
gulp.task('test', ['test-unit']);

gulp.task('transpile', ['transpile-cli', 'transpile-src']);

gulp.task('transpile-cli', function transpileCli() {
  return gulp.src(cliPath)
    .pipe(babel())
    .pipe(gulp.dest('bin'));
});

gulp.task('transpile-src', function transpileSrc() {
  return gulp.src(jsPaths)
    .pipe(babel())
    .pipe(gulp.dest('lib'));
});

gulp.task('watch', function watch() {
  gulp.watch(jsPaths, ['transpile']);
});

gulp.task('watch-tests', function watch() {
  gulp.watch(jsPaths.concat(specPaths), ['test-unit']);
});

gulp.task('pre-test-unit', function preUnitTest() {
  return gulp
    .src(jsPaths)
    .pipe(istanbul({
      includeUntested: true
    }))
    .pipe(istanbul.hookRequire());
});

gulp.task('test-unit', ['lint', 'pre-test-unit'], function testUnit() {
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
    }));
});

gulp.task('lint', function lint() {
  return gulp.src(jsPaths.concat(specPaths))
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});
