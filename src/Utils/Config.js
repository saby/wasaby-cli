const fs = require('fs-extra');

const pathUtils = require('./path');

const isUrl = /(git|ssh|https?|git@[-\w.]+):/;

class Config {
   constructor(command) {
      this.params = new Map();

      const consoleOpts = this.readConsoleOptions({...(command?.parent?.opts() || {}), ...command.opts()});
      const packageConfig = this.readPackageJson();
      const userConfig = this.readUserConfig(consoleOpts.get('config') || packageConfig.get('config'));
      const mainConfig = this._mergeConfigs(packageConfig, userConfig);

      this.params = new Map([...mainConfig, ...consoleOpts]);

      for (const [name, value] of this.params.entries()) {
         if (Array.isArray(value)) {
            const newArr = [...new Set([...value, ...(mainConfig.get(name) || [])])];

            this.params.set(name, newArr);

            continue;
         }

         if (mainConfig.has(name) && command.getOptionValueSource(name) === 'default') {
            this.params.set(name, mainConfig.get(name));
         }
      }

      this._prepareParams(command);
   }

   readConsoleOptions(consoleOpts) {
      const result = new Map();

      for (const [name, value] of Object.entries(consoleOpts)) {
         result.set(name, value);
      }

      return result;
   }

   readPackageJson() {
      const result = new Map();
      const ownConfig = require('./../../package.json');
      const packageJson = Config.getPackageJson(process.cwd()) || ownConfig;
      const wcSection = packageJson['wasaby-cli'] || {};

      result.set('cliVersion', ownConfig.version.split('.', 2).join('.'));
      result.set('rc', `rc-${packageJson.version.split('.', 2).join('.')}`);

      this._readConfig(result, wcSection, process.cwd());

      if (packageJson.name !== 'wasaby-cli') {
         // TODO Убрать, когда научимся получать полный список модулей, а не использовать наш обрубок.
         result.set('isLocaleProject', true);

         result.set('rep', [process.cwd()]);

         if (result.has('repositories')) {
            result.get('repositories').push(process.cwd());
         } else {
            result.set('repositories', [process.cwd()]);
         }
      }

      return result;
   }

   readUserConfig(pathUserConfig) {
      const result = new Map();

      if (pathUserConfig) {
         if (!fs.pathExistsSync(pathUserConfig)) {
            console.warn(`User config is not exists by path ${pathUserConfig}`);

            return result;
         }

         const config = require(pathUserConfig);
         const dirUserConfig = pathUtils.dirname(pathUserConfig);

         this._readConfig(result, config, dirUserConfig);
      }

      return result;
   }

   _readConfig(params, config, root) {
      for (const [paramName, value] of Object.entries(config)) {
         if (paramName === 'repositories') {
            const repos = [];

            for (const url of value) {
               if (isUrl.test(url)) {
                  repos.push(url);

                  continue;
               }

               repos.push(Config.preparePath(url, root));
            }

            params.set(paramName, repos);

            continue;
         }

         if (paramName === 'expressRoute') {
            const userRoutes = new Map();

            for (const [name, routerPath] of Object.entries(value)) {
               userRoutes.set(name, Config.preparePath(routerPath, root));
            }

            params.set(paramName, userRoutes);

            continue;
         }

         params.set(paramName, Config.preparePath(value, root));
      }
   }

   _mergeConfigs(packageConfig, userConfig) {
      const result = new Map([...userConfig, ...packageConfig]);

      for (const [name, value] of result.entries()) {
         if (Array.isArray(value)) {
            const newArr = [...new Set([...value, ...userConfig.get(name) || []])];

            result.set(name, newArr);
         }
      }

      return result;
   }

   _prepareParams() {
      const params = this.params;

      if (params.has('store')) {
         let storePath = params.get('store');

         if (!pathUtils.isAbsolute(storePath)) {
            storePath = pathUtils.join(process.cwd(), storePath);
         }

         // TODO на _repos остались завязаны srv и скрипт сборки. В версии 2.x.x надо убрать эти привязки.
         params.set('store', pathUtils.join(storePath, '_repos'));
      } else {
         params.set('store', pathUtils.join(params.get('artifactsDir'), 'store', '_repos'));
      }

      if (params.has('projectDir')) {
         params.set('resources', pathUtils.join(params.get('workDir'), 'build-ui', 'resources'));
         params.set('buildTools', 'jinnee');
      } else {
         params.set('resources', params.get('workDir'));
      }
   }

   toString() {
      return JSON.stringify([...this.params], null, 3);
   }

   static getPackageJson(pathToRep) {
      const configPath = pathUtils.join(pathToRep, 'package.json');

      if (fs.pathExistsSync(configPath)) {
         return fs.readJsonSync(configPath);
      }

      return undefined;
   }

   static preparePath(value, root = process.cwd()) {
      if (pathUtils.isRelativePath(value)) {
         return pathUtils.join(root, value);
      }

      return value;
   }

   static numberParser(value) {
      return Number(value);
   }

   static pathParser(value) {
      return Config.preparePath(value);
   }
}

module.exports = Config;
