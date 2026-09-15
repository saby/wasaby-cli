const fs = require('fs');
const path = require('path');

const WS_NAME = 'WS.Core';
const REQUIREJS_LOADER_MODULE = 'RequireJsLoader';
const WS_APP_NAME = 'Application';

function isWsExists(appRoot) {
   return fs.existsSync(path.join(appRoot, `${WS_NAME}/${WS_NAME}.s3mod`));
}

function isWsAppExists(appRoot) {
   return fs.existsSync(path.join(appRoot, `${WS_APP_NAME}/${WS_APP_NAME}.s3mod`));
}

function getRequireJsLoaderPath(appRoot) {
   const moduleExists = fs.existsSync(path.join(appRoot, REQUIREJS_LOADER_MODULE, REQUIREJS_LOADER_MODULE + '.s3mod'));
   return moduleExists ? REQUIREJS_LOADER_MODULE : '';
}

function getRequireJsPath(appRoot, forBrowser, patched) {
   if (forBrowser) {
      const loaderPath = getRequireJsLoaderPath(appRoot);
      return loaderPath ? `${loaderPath}/require.js` : 'node_modules/requirejs/require.js';
   }

   return patched ? path.resolve(__dirname, '../requirejs/r.js') : 'requirejs';
}

function getRequireJsConfigPath(appRoot) {
   const loaderPath = getRequireJsLoaderPath(appRoot);
   return loaderPath ? `${loaderPath}/config.js` : '';
}

function getWsConfig(appRoot, options) {
   const actualOptions = { ...options };

   if (actualOptions.appPath === undefined) {
      actualOptions.appPath = '';
   }
   if (actualOptions.resourcePath === undefined) {
      actualOptions.resourcePath = '/';
   }
   if (actualOptions.loadCss === undefined) {
      actualOptions.loadCss = true;
   }

   if (!actualOptions.wsPath && isWsExists(appRoot)) {
      actualOptions.wsPath = WS_NAME;
   }

   return {
      debug: true,
      appRoot: actualOptions.appPath,
      resourceRoot: actualOptions.resourcePath,
      wsRoot: actualOptions.wsPath,
      loadCss: actualOptions.loadCss,
      showAlertOnTimeoutInBrowser: false,
      versioning: false,
      unitTestMode: true
   };
}

module.exports = {
   getRequireJsPath,
   getRequireJsConfigPath,
   isWsAppExists,
   getWsConfig
};
