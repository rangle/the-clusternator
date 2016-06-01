/*
 * Maps the different app backend types to relevant node versions.
 *
 * This is used for the clusternator init menu, and also to generate the
 * base Dockerfile and Circle.yml during clusternator init.
 *
 * NB: when you want to update these versions, make sure to build and publish
 * new base image in dockerfiles/clusternator-node.
 */
module.exports = {
  'node (current)': {
    dockerTemplate: 'dockerfile-template-node',
    options: {
      NODE_MAJOR_VERSION: '6',
      NODE_FULL_VERSION: '6.2.0'
    }
  },
  'node (long-term-support)': {
    dockerTemplate: 'dockerfile-template-node',
    options: {
      NODE_MAJOR_VERSION: '4',
      NODE_FULL_VERSION: '4.4.5'
    }
  },
  'static': {
    dockerTemplate: 'dockerfile-template-nginx',
    option: {
      NODE_MAJOR_VERSION: '4',
      NODE_FULL_VERSION: '4.4.5'
    }
  }
};
