const { join } = require('path');
const { BootstrapStarter } = require('@ali/midway-fc-starter');
const starter = new BootstrapStarter();

module.exports = starter.start({
  appDir: __dirname,
  baseDir: join(__dirname, 'dist'),
  initializeMethodName: 'initializer',
});
