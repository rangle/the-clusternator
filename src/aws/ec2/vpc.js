'use strict';

const filter = require('./ec2-filter');

module.exports = {
  findProject: findProjectVPC,
  helpers: {
    findProjectTag: findProjectTag,
    findProjectVPC: findProjectVPC,
    findMasterVPC: findMasterVPC
  },
  create,
  describe,
  destroy,
  list
};

/**
 * @param {AwsWrapper} aws
 * @returns {function(): Promise}
 */
function describe(aws) {

  function promiseToDescribe() {
    return aws.ec2.describeVpcs({
      DryRun: false,
      Filters: [filter.createClusternator()]
    });
  }

  return promiseToDescribe;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} cidrBlock
 * @returns {function(): Promise<object>}
 */
function create(aws, cidrBlock) {

  function promiseToCreate() {
    return aws.ec2
      .createVpc({
        DryRun: false,
        CidrBlock: cidrBlock
      })
      .then((result) => result.Vpc);
  }

  return promiseToCreate;
}

/**
 * @param {AwsWrapper} aws
 * @param {string} vpcId
 * @returns {function(): Promise.<string>}
 */
function destroy(aws, vpcId) {

  function promiseToDestroy() {
    return aws.ec2
      .deleteVpc({VpcId: vpcId})
      .then(() => 'deleted');
  }

  return promiseToDestroy;
}

/**
 * @param {Object} el
 * @returns {string}
 */
function mapDescription(el) {
  return el.VpcId;
}

/**
 * @param {Array} descriptions
 * @returns {Array}
 */
function mapDescribeToVpcIds(descriptions) {
  return descriptions.map(mapDescription);
}

/**
 * @param {AwsWrapper} aws
 * @returns {function(): Promise<string[]>}
 */
function list(aws) {

  function promiseToList() {
    return describe(aws)()
      .then((result) => mapDescribeToVpcIds(result.Vpcs));
  }

  return promiseToList;
}

/**
  finds a vpc from a project
  @param {string} projectId
  @param {Object} list (see AWS docs)
  http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2.html
*/
function findProjectTag(projectId, list) {

  function promiseToFindProjectTag() {
    var vpc = null;
    list.Vpcs.forEach(function (vDesc) {
      vDesc.Tags.forEach(function (tag) {
        if (tag.Key !== constants.PROJECT_TAG) {
          return;
        }
        if (tag.Value === projectId) {
          vpc = vDesc;
        }
      });
    });
    return vpc;
  }

  return promiseToFindProjectTag;
}

/**
  finds the _last_ clusternator tagged VPC _without_ a clusternator proj tag
  @param {Object} list (see AWS docs)
  http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2.html
*/
function findMasterVPC(list) {

  function promiseToFindMasterVPC() {
    var vpc = null;
    list.Vpcs.forEach(function (vDesc) {
      var foundTag = false;
      vDesc.Tags.forEach(function (tag) {
        if (tag.Key === constants.PROJECT_TAG) {
          foundTag = true;
        }
      });
      if (!foundTag) {
        vpc = vDesc;
      }
    });
    return vpc;
  }

  return promiseToFindMasterVPC;
}

function findProjectVPC(projectId) {

  function promiseToFindProjectVPC() {
    return describe().then(function (list) {
      var vpc = findProjectTag(projectId, list);
      if (vpc) {
        return vpc;
      }
      vpc = findMasterVPC(list);
      if (vpc) {
        return vpc;
      }
      throw new Error('No Clusternator VPCs found');
    });
  }

  return promiseToFindProjectVPC
}