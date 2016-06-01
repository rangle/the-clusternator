'use strict';

const R = require('ramda');

const setup = require('./setup');
const util = require(setup.path('util'));
const iam = require(setup.path('aws', 'iam', 'iam.js'));

const partialedIam = R.mapObjIndexed(iamAwsPartial, iam);

function iamAwsPartial(fn) {
  return R.partial(fn, { iam: util.makePromiseApi(setup.getIam()) });
}

module.exports = partialedIam;
