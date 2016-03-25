#!/usr/bin/env node
/**
 * This is a shell script stub that references {@link module:api/'0.1'/cli}
 This script serves only a basic utility purpose of loading the API the user
 has configured.
 * @module clusternatorCli
 */

'use strict';

const USER = require('../lib/config')().user;
const API = USER ?
    USER.apiVersion : require('../lib/constants').DEFAULT_API_VERSION;

const yargs = require('yargs');

const cli = require(`../lib/api/${API}/cli/cli-api`);
cli.configure(yargs);
