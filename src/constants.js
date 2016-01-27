'use strict';

const CLUSTERNATOR_PREFIX = 'clusternator';
const DELIM = '-';
const CLUSTERNATOR_TAG = CLUSTERNATOR_PREFIX + DELIM + 'created';
const DEPLOYMENT_TAG = CLUSTERNATOR_PREFIX + DELIM + 'deployment';
const EXPIRES_TAG = CLUSTERNATOR_PREFIX + DELIM + 'expires';
const PROJECT_TAG = CLUSTERNATOR_PREFIX + DELIM + 'project';
const PROJECT_USER_TAG = CLUSTERNATOR_PREFIX + DELIM + 'project' + DELIM;
const PR_TAG = CLUSTERNATOR_PREFIX + DELIM + 'pr';
const SHA_TAG = CLUSTERNATOR_PREFIX + DELIM + 'sha';
/**const NOTEconst EC2const AMI'sconst areconst regionconst specificconst */
//const AWS_DEFAULT_EC2_AMI = 'ami-8da458e6';
//const AWS_DEFAULT_EC2_AMI = 'ami-e2b1f988';
const AWS_DEFAULT_EC2_AMI = 'ami-e7acf78d';
const AWS_DEFAULT_EC2_TYPE = 't2.micro';
const SSH_PUBLIC_PATH = 'ssh-public';
const AWS_APIS = Object.freeze({
  dynamodb: '2012-08-10',
  ec2: '2015-10-01',
  ecr: '2015-09-21',
  ecs: '2014-11-13',
  iam: '2010-05-08',
  route53: '2013-04-01'
});


const constants = Object.freeze({
  PROJECT_USER_TAG,
  DEFAULT_API_VERSION: '0.1',
  LOG_LEVELS: Object.freeze({
    0: 'error',
    1: 'warn',
    2: 'info',
    3: 'verbose',
    4: 'debug',
    5: 'silly'
  }),
  AWS_APIS,
  AWS_SSL_ID: 'arn:aws:iam::731670193630:server-certificate/clusternator-wildcard',
  AWS_ZONE:  'us-east-1',
  AWS_R53_ZONE_PREFIX: '/hostedzone/',
  AWS_DEFAULT_EC2_AMI,
  AWS_DEFAULT_EC2_TYPE,
  AWS_EC2_POLL_INTERVAL: 15000, // ms to wait between polling EC2 statuses
  AWS_EC2_POLL_MAX: 40, // times to retry EC2 polls (create/terminate)
  AWS_DEFAULT_CIDR: '10.0.0.0/24',
  AWS_DEFAULT_AZ: 'us-east-1a',
  AWS_FILTER_CTAG: [{
    Name: 'tag-key',
    Values: [
      CLUSTERNATOR_TAG
    ]
  }],
  CLUSTERNATOR_PREFIX,
  CLUSTERNATOR_TAG,
  DEPLOYMENT_TAG,
  EXPIRES_TAG,
  PROJECT_TAG,
  PR_TAG,
  SHA_TAG,
  SSH_PUBLIC_PATH,
  AWS_DEFAULT_EC2: Object.freeze({
    ImageId: AWS_DEFAULT_EC2_AMI,
    MaxCount: 1,
    MinCount: 1,

    DisableApiTermination: false,

    IamInstanceProfile: {
      Name: 'ecsInstanceRole'
    },

    EbsOptimized: false,

    InstanceInitiatedShutdownBehavior: 'terminate',

    InstanceType: AWS_DEFAULT_EC2_TYPE,

    Monitoring: {
      // @todo investigate cloud watch
      Enabled: true /* required */
    },

    NetworkInterfaces: [ ],

    Placement: {
      Tenancy: 'default'
    }
  })
});

module.exports = constants;
