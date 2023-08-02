/**
 * Setups RequireJS for WS
 */

let fs = require('fs');

function setupRequireJs(requirejs, configPath, projectRootPath, dependencies, wsRootPath, contents) {
   const CONFIG_EXISTS = fs.existsSync(configPath);

   let config = {
      baseUrl: projectRootPath,
      availableModules: contents.modules
   };

   // set baseUrl in requirejs to be able to require
   // new AMD-formatted requirejs config
   requirejs.config(config);
   if (CONFIG_EXISTS) {
      let requirejsConfig = requirejs('RequireJsLoader/config');
      config = requirejsConfig.createConfig(
         projectRootPath,
         wsRootPath,
         '',
         contents
      );
   }

   config.nodeRequire = require;
   requirejs.config(config);

   if (dependencies) {
      dependencies.forEach((name) => {
         requirejs(name);
      });
   }
}

exports.requireJs = setupRequireJs;
