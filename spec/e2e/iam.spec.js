'use strict';

const R = require('ramda');

var setup = require('./setup');
var util = require(setup.path('util'));
var iam = require(setup.path('aws', 'iam.js'));

const partialedIam = R.mapObjIndexed(iamAwsPartial, iam);

function iamAwsPartial(fn) {
  return R.partial(fn, { iam: util.makePromiseApi(setup.getIam()) });
}

module.exports = partialedIam;
