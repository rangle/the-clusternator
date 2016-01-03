#!/usr/bin/env node


'use strict';

var USER = require('../lib/config')().user;
var API = USER ? USER.apiVersion : require('../lib/constants').DEFAULT_API_VERSION;

var yargs = require('yargs');

require('../lib/api/' + API + '/cli/cli-api')(yargs);