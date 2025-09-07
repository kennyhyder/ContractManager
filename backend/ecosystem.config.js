// PM2 Configuration
module.exports = {
  apps: [{
    name: 'cms-api',
    script: './server.js',
    instances: 'max',
    exec_mode: 'cluster'
  }]
};
