'use strict';

const util = require('../util');
const constants = require('../constants');

const EXPORTS = {
  AWS_APIS: {
    dynamodb: '2012-08-10',
    ec2: '2015-10-01',
    ecr: '2015-09-21',
    ecs: '2014-11-13',
    iam: '2010-05-08',
    route53: '2013-04-01'
  },
  AWS_DEFAULT_AZ: 'us-east-1a',
  AWS_DEFAULT_EC2_AMI: 'ami-e7acf78d',
  AWS_DEFAULT_EC2_TYPE: 't2.micro',
  AWS_EC2_POLL_INTERVAL: 15000, // ms to wait between polling EC2 statuses
  AWS_EC2_POLL_MAX: 40, // times to retry EC2 polls (create/terminate)
  AWS_FILTER_CTAG: [{
    Name: 'tag-key',
    Values: [
      constants.CLUSTERNATOR_TAG
    ]
  }],
  AWS_R53_ZONE_PREFIX: '/hostedzone/',
  AWS_SSL_ID:
    'arn:aws:iam::731670193630:server-certificate/clusternator-wildcard',
  AWS_RETRY_DELAY: 1500,
  AWS_RETRY_LIMIT: 3,
  AWS_RETRY_MULTIPLIER: 3,
  ALT_TAG: '-alt',
  CIDR_BLOCK: '10.0.0.0/16',
  PR_EXPIRY: 48 * 60 * 60 * 1000  // 48 hrs
};

module.exports = util.deepFreeze(EXPORTS);
