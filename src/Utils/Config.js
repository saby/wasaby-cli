const fs = require('fs-extra');

const pathUtils = require('./path');
const Repository = require('../Entities/Repository');
const RepositoriesMap = require('../Map/Repositories');

const isUrl = /(git|ssh|https?|git@[-\w.]+):/;

const repositoriesMap = require('../../resources/repositories.json');

const arrayParamsList = [
   'rep',
   'modules',
   'entry',
   'tasks',
   'moduleName',
   'localization',
   'countries',
   'preCommitHooks',
   'coveredModules',
   'linters',
   'files',
];
const stringParamsList = [
   'workDir',
   'rc',
   'projectDir',
   'artifactsDir',
   'store',
   'protocol',
   'builderCache',
   'parallelNodeTest',
   'parallelBrowserTest',
   'retries',
   'type',
   'path',
   'hooksPath',

   'workspace',
   'environment',

   'screenshotsDir',
   'browserLogsDir',
   'logLevel',
   'extensionForTemplate',

   'responsibleId',
   'responsible',
   'kaizen'
];
const numberParamsList = [
   'maxInstances',
   'waitForTimeout',
   'driverPort',
   'port',
   'parallelJSDOMTest',
   'parallelNodeJSTest',
   'timeoutTests',
   'mochaTimeout',
   'esVersion',
   'maxWorkers',

   'parallelNodeTest',
   'parallelBrowserTest'
];

class Config {
   constructor() {
      this.consoleParams = new Map();
      this.packageParams = new Map();
      this.userParams = new Map();
   }

   read(consoleArgs) {
      this.readConsole(consoleArgs);
      this.readPackageJson();
      this.readUserConfig();

      this._mergeParams();
      this._prepareParams();
   }

   _mergeParams() {
      this.params = new Map([...this.packageParams, ...this.userParams, ...this.consoleParams]);

      for (const nameParam of arrayParamsList) {
         this.params.set(
            nameParam,
            [
               ...(this.packageParams.get(nameParam) || []),
               ...(this.userParams.get(nameParam) || []),
               ...(this.consoleParams.get(nameParam) || [])
            ]
         );
      }
   }

   readUserConfig() {
      let pathUserConfig = this.packageParams.get('config') || this.consoleParams.get('config');

      if (pathUserConfig) {
         if (!pathUtils.isAbsolute(pathUserConfig)) {
            pathUserConfig = pathUtils.join(process.cwd(), pathUserConfig);
         }

         if (!fs.pathExistsSync(pathUserConfig)) {
            console.warn(`User config is not exists by path ${pathUserConfig}`);

            return;
         }

         const config = require(pathUserConfig);
         const dirUserConfig = pathUtils.dirname(pathUserConfig);

         this._readConfig(this.userParams, config, dirUserConfig);
      }
   }

   readConsole(consoleArgs) {
      for (const arg of consoleArgs) {
         if (arg.startsWith('--')) {
            const [, name, value] = arg.match(/--([\w-.]+)(?:=(\S*))?/);

            this.consoleParams.set(name, Config.prepareConsoleParam(name, value));
         }
      }
   }

   readPackageJson() {
      const ownConfig = require('./../../package.json');
      const packageJson = Config.getPackageJson(process.cwd()) || ownConfig;
      const wcSection = packageJson['wasaby-cli'] || {};

      this.packageParams.set('cliVersion', ownConfig.version.split('.', 2).join('.'));
      this.packageParams.set('rc', `rc-${packageJson.version.split('.', 2).join('.')}`);

      this._readConfig(this.packageParams, wcSection, process.cwd());

      if (packageJson.name !== 'wasaby-cli') {
         // TODO Убрать, когда научимся получать полный список модулей, а не использовать наш обрубок.
         this.packageParams.set('isLocaleProject', true);

         this.packageParams.set('rep', [process.cwd()]);

         if (this.packageParams.has('repositories')) {
            this.packageParams.get('repositories').push(process.cwd());
         } else {
            this.packageParams.set('repositories', [process.cwd()]);
         }
      }
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

   _prepareParams() {
      const params = this.params;

      if (params.get('hotReload')) {
         params.set('watcher', true);
      }

      if (!params.get('logLevel')) {
         params.set('logLevel', 'info');
      }

      if (!params.has('workDir')) {
         params.set('workDir', Config.convertToAbsolutePath('application'));
      }

      // TODO Удалить, когда параметр workspace не будут передавать в jenkins-е.
      if (params.has('workspace')) {
         params.set('artifactsDir', pathUtils.join(params.get('workspace'), 'artifacts'));
      }

      if (!params.has('artifactsDir')) {
         params.set('artifactsDir', Config.convertToAbsolutePath('wasaby-cli_artifacts'));
      }

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

      if (!params.has('builderCache')) {
         params.set('builderCache', Config.convertToAbsolutePath('./build-ui/builder-json-cache'));
      }

      if (params.has('projectDir')) {
         params.set('buildTools', 'jinnee');
         params.set('resources', pathUtils.join(params.get('workDir'), 'build-ui', 'resources'));
      } else {
         params.set('buildTools', 'builder');
         params.set('resources', params.get('workDir'));
      }
   }

   // TODO Надо подумать куда убрать эту функцию, подготовка репозиториев не относиться к конфигу.
   async prepareRepositories() {
      const repositories = new RepositoriesMap();
      const store = this.params.get('store');
      const userRepos = [
         ...(this.packageParams.get('repositories') || []),
         ...(this.userParams.get('repositories') || [])
      ];

      for (const url of repositoriesMap) {
         const repository = new Repository({
            url: this._prepareUrl(url),
            dir: store
         });
         const branch = this.consoleParams.get(repository.name);

         if (repository.isCDN()) {
            repository.requireLoading = true;
            repository.requiredBranch = branch || this.params.get('cdn') || this.params.get('rc');
         } else {
            repository.requiredBranch = branch || this.params.get('rc');
         }

         repositories.add(repository);
      }

      for (const link of userRepos) {
         if (isUrl.test(link)) {
            const [url, version] = link.split('#');

            const repository = new Repository({
               url: this._prepareUrl(url),
               dir: store,
               requiredBranch: version || this.params.get('rc'),
               requireLoading: true
            });

            repositories.add(repository);

            continue;
         }

         const repInfo = await Repository.getInfo(link);

         this.params.set('rep', this.params.get('rep').map(repName => (repName === link ? repInfo.name : repName)));

         repositories.add(new Repository({
            ...repInfo,
            freezeStateOfCommits: true,
            requireLoading: true,
            requiredBranch: this.params.get('rc')
         }));
      }

      this.params.set('repositories', repositories);
   }

   _prepareUrl(url) {
      if (this.params.get('protocol') === 'ssh' && url.startsWith('https://')) {
         return url.replace('https://', 'git@').replace('/', ':');
      }

      if (this.params.get('protocol') === 'https' && url.startsWith('git@')) {
         return url.replace(':', '/').replace('git@', 'https://');
      }

      return url;
   }

   static getPackageJson(pathToRep) {
      const configPath = pathUtils.join(pathToRep, 'package.json');

      if (fs.pathExistsSync(configPath)) {
         return fs.readJsonSync(configPath);
      }

      return undefined;
   }

   static prepareConsoleParam(key, value) {
      if (value === undefined) {
         return true;
      }

      if (arrayParamsList.includes(key)) {
         return value.split(',').map(element => element.trim());
      }

      if (numberParamsList.includes(key)) {
         return +value;
      }

      if (stringParamsList.includes(key) && Config.isRelativePath(value)) {
         return Config.convertToAbsolutePath(value);
      }

      return value;
   }

   static preparePath(value, root) {
      if (Config.isRelativePath(value)) {
         return Config.convertToAbsolutePath(value, root);
      }

      return value;
   }

   static convertToAbsolutePath(value, root = process.cwd()) {
      return pathUtils.join(root, value);
   }

   static isRelativePath(value) {
      return typeof value === 'string' && value.includes('/') && !pathUtils.isAbsolute(value);
   }
}

module.exports = Config;
