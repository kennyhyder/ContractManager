// cypress/plugins/index.js
const webpack = require('@cypress/webpack-preprocessor');
const { initPlugin } = require('cypress-plugin-snapshots/plugin');

module.exports = (on, config) => {
  // Webpack preprocessor for TypeScript support
  const options = {
    webpackOptions: require('../../webpack.config'),
    watchOptions: {}
  };
  on('file:preprocessor', webpack(options));

  // Initialize snapshot plugin
  initPlugin(on, config);

  // Custom tasks
  on('task', {
    // Database tasks
    'db:seed': (data) => {
      // Implementation would connect to test database and seed data
      console.log('Seeding database with:', data);
      return null;
    },
    
    'db:clean': () => {
      // Implementation would clean test database
      console.log('Cleaning database');
      return null;
    },

    // WebSocket tasks for testing real-time features
    'websocket:emit': ({ event, data }) => {
      // Implementation would emit WebSocket events
      console.log(`Emitting WebSocket event: ${event}`, data);
      return null;
    },

    // Logging task
    log: (message) => {
      console.log(message);
      return null;
    },

    // Failed test screenshot
    failed: require('cypress-failed-log/src/failed')()
  });

  // Code coverage
  require('@cypress/code-coverage/task')(on, config);

  // Environment variable handling
  config.env = config.env || {};
  config.env.API_URL = process.env.CYPRESS_API_URL || config.env.apiUrl;

  return config;
};