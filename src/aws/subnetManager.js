'use strict';
/**
 * Simplifies dealing with AWS VPC subnets
 *
 * @module aws/subnetManager
 */

const Q = require('q');
const util = require('../util');
const constants = require('../constants');
const awsConstants = require('./aws-constants');

let Vpc = require('./ec2/vpc');
let common = require('./common');

/**
  @param {EC2} AWS ec2 object
  @return {Ec2Manager}
*/
function getSubnetManager(ec2, vpcId) {
  ec2 = util.makePromiseApi(ec2);

  const vpc = Vpc.bindAws({ ec2, vpcId });
  const baseFilters = awsConstants.AWS_FILTER_CTAG.concat(
    common.makeAWSVPCFilter(vpcId));
  const describe = common.makeEc2DescribeFn(
    ec2, 'describeSubnets', 'Subnets', baseFilters);
  const describeProject = common.makeEc2DescribeProjectFn(describe);

  /**
  @return {Q.Promise}
  */
  function getCidrPrefix() {
    /** 
     * @todo this cidr function should be injected from elsewhere instead of
     * determined by this module.  Subnets is due for its upgrade.
     */
    return vpc.findVpc()().then(function(v) {
      return util.getCidrPrefixFromIPString(v.CidrBlock);
    });
  }

  /**
  @param {CIDR[]} list
  @return {number}
  */
  function findHighestCidr(list) {
    if (!list.length) {
      throw new Error('findHighestCidr given empty list');
    }
    let highest = -1;
    list.forEach(function(r) {
      const cidr = r.CidrBlock;
      const classes = cidr.split('.');
      let c;
      classes.pop();
      c = +classes.pop();
      if (c > highest) {
        highest = c;
      }
    });
    return +highest;
  }

  /**
    @param {CIDR[]} list
    @return {string}
  **/
  function incrementHighestCidr(list) {
    let highest = findHighestCidr(list);
    highest += 1;
    return highest + '.0/24';
  }

  /**
    @return {Q.Promise<string>}
  */
  function getCidrPostfix() {
    return describe().then(incrementHighestCidr);
  }

  /**
    @param {string[]} [subnetPreix, subnetPostfix]
    @return {string}
  */
  function concatSubnetComponents(results) {
    return results.join('.');
  }

  /**
    @param {string} pid
    @return {Q.Promise<string>}
  */
  function getNextSubnet(pid) {
    return Q.all([
      getCidrPrefix(pid),
      getCidrPostfix()
    ]).then(concatSubnetComponents);
  }

  /**
    @param {SubnetDescription}
    @param {string}
    @return {Q.Promise}
  */
  function associateRoute(snDesc, routeId) {
    const id = snDesc.Subnet.SubnetId;
    return ec2.associateRouteTable({
      RouteTableId: routeId,
      SubnetId: id
    });
  }

  /**
    @param {string} pid
    @param {SubnetDescription[]}
    @return {boolean}
  */
  function isPidInSubnetList(pid, list) {
    let found = false;
    list.forEach(function(sn) {
      sn.Tags.forEach(function(tag) {
        if (tag.Key === constants.PROJECT_TAG) {
          if (tag.Value === pid) {
            found = true;
          }
        }
      });
    });
    return found;
  }

  /**
    @param {string} pid
    @param {SubnetDescription[]}
    @throws {Error}
  */
  function throwIfPidFound(pid, list) {
    if (isPidInSubnetList(pid, list)) {
      throw new Error('Create Subnet Failed: Project: ' + pid +
        ' exists');
    }
  }

  /**
    @param {string} pid
    @return {Q.Promise}
  */
  function findExistingPid(pid) {
    return describeProject(pid).then(function(list) {
      //throwIfPidFound(pid, list);
      if (list.length) {
        return list[0];
      } else {
        return;
      }
    });
  }

  /**
  finds a subnet from a project
  @param {string} projectId
  @param {Object} list (see AWS docs)
  http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2.html
  */
  function findProjectTag(projectId, list) {
    let subnet = null;
    list.forEach(function(sDesc) {
      sDesc.Tags.forEach(function(tag) {
        if (tag.Key !== constants.PROJECT_TAG) {
          return;
        }
        if (tag.Value === projectId) {
          subnet = sDesc;
        }
      });
    });
    return subnet;
  }

  /**
    @param {string} projectId
    @param {SubnetDescription[]}
    @return {SubnetDescription}
    @throws {Error}
  */
  function throwIfSubnetNotFound(projectId, list) {
    let subnet = findProjectTag(projectId, list);
    if (subnet) {
      return subnet;
    }
    throw new Error('No Clusternator Subnet Found For Project: ' + projectId);
  }

  /**
    @param {string} projectId
    @return {Q.Promise}
  */
  function findProjectSubnet(projectId) {
    return describe().then(function(list) {
      return throwIfSubnetNotFound(projectId, list);
    });
  }

  /**
    @param {{ NetworkAcls: NetworkAclsDescriptions[]}}
    @return {NetworkAclDescriptions[]}
  */
  function filterIsDefault(results) {
    return results.NetworkAcls.filter(function(a) {
      return a.IsDefault;
    });
  }

  /**
    @return {Q.Promise}
  */
  function describeDefault() {
    // Trying to use a Filter on 'default', as per the docs didn't work
    // AWS wants a boolean, but their code wants a string, nothing comes back
    // filter default manually instead
    return ec2.describeNetworkAcls({
      DryRun: false,
      Filters: common.makeAWSVPCFilter(vpcId)
    }).
    then(filterIsDefault);
  }

  /**
    @param {string} subnetId
    @param {NetworkAclAssociations[]}
    @return {NetworkAclAssociations[]}
   */
  function getFilteredAssociations(subnetId, list) {
    if (!list.length) {
      throw new Error('AclManager: Error expecting a default ACL');
    }
    return list[0].Associations.filter(function(el) {
      return el.SubnetId === subnetId;
    });
  }

  /**
    @param {string} subnetId
    @return {Q.Promise}
  */
  function defaultAssoc(subnetId) {
    return describeDefault().then(function(list) {
      return getFilteredAssociations(subnetId, list);
    });
  }

  /**
    @param {Array}
    @return {string}
    @throws {Error}
  */
  function throwIfNetworkAclAssocListEmpty(list) {
    if (!list.length) {
      throw new Error('AclManager: Error expecting a default ACL ' +
        'Association');
    }
    return list[0].NetworkAclAssociationId;
  }

  /**
   @param {string} subnetId
   @return {Q.Promise<string>}
  */
  function defaultAssocId(subnetId) {
    return defaultAssoc(subnetId).then(throwIfNetworkAclAssocListEmpty);
  }

  /**
    @param {SubnetDescription} snDesc
    @param {string} aclId
  */
  function associateAcl(snDesc, aclId) {
    const snId = snDesc.Subnet.SubnetId;
    return defaultAssocId(snId).then(function(assocId) {
      return ec2.replaceNetworkAclAssociation({
        AssociationId: assocId,
        NetworkAclId: aclId
      });
    });
  }

  /**
    @param {string} pid
  */
  function destroy(pid) {
    if (!pid) {
      throw new TypeError('Destroy subnet requires a project id');
    }
    return describe(pid).then(function(list) {
      if (!list.length) {
        common.throwInvalidPidTag(pid, 'looking', 'Subnet');
      }

      const subnetId = list[0].SubnetId;

      return ec2.deleteSubnet({
        SubnetId: subnetId
      });
    });

  }

  function createSubnet(params) {
    const pid = params.pid;
    delete params.pid; // aws doesn't like extra params :/
    return ec2.createSubnet(params).then(function(results) {
      return common.awsTagEc2(ec2, results.Subnet.SubnetId, [{
        Key: constants.CLUSTERNATOR_TAG,
        Value: 'true'
      }, {
        Key: constants.PROJECT_TAG,
        Value: pid
      }]).then(function() {
        return results;
      });
    });
  }

  function create(pid, routeId, aclId, az) {
    if (!pid) {
      throw new Error('subnetManager.create requires a project id param');
    }
    if (!routeId) {
      throw new Error('subnetManager.create requires a routeId param');
    }
    if (!aclId) {
      throw new Error('subnetManager.create requires an aclId param');
    }
    return findExistingPid(pid).then(function(result) {
      if (result) {
        return result;
      }
      return getNextSubnet(pid).then(function(cidr) {
        return {
          VpcId: vpcId,
          CidrBlock: cidr,
          AvailabilityZone: az || awsConstants.AWS_DEFAULT_AZ,
          pid: pid
        };
      }).
      then(createSubnet).
      then(function(snDesc) {
        return associateRoute(snDesc, routeId).then(function() {
          return snDesc;
        });
      }).then(function(snDesc) {
        return associateAcl(snDesc, aclId).then(function() {
          return snDesc;
        });
      });
    });
  }


  return {
    describe,
    describeProject,
    defaultAssocId,
    create,
    destroy,
    findProject: findProjectSubnet,
    helpers: {
      associateAcl,
      associateRoute,
      concatSubnetComponents,
      defaultAssoc,
      defaultAssocId,
      filterIsDefault,
      findExistingPid,
      findHighestCidr,
      findProjectTag,
      getCidrPostfix,
      getCidrPrefix,
      getFilteredAssociations,
      getNextSubnet,
      incrementHighestCidr,
      isPidInSubnetList,
      throwIfNetworkAclAssocListEmpty,
      throwIfPidFound,
      throwIfSubnetNotFound
    }
  };
}

module.exports = getSubnetManager;
