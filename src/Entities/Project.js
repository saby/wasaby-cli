const fs = require('fs-extra');
const pMap = require('p-map');

const logger = require('../Utils/Logger');
const pathUtils = require('../Utils/path');
const DefaultBuilder = require('./Builder');
const Jinnee = require('./Jinnee');
const TestController = require('../TestController/TestController');
const ModulesMap = require('../Map/Modules');
const Store = require('../Store');
const Service = require('./Service');
const Repository = require('./Repository');
const AutoDoc = require('./AutoDoc');
const Server = require('../Server/Server');

const SubsystemController = require('../Utils/SubsystemController');

const TSConfig = require('../TypeSript/Config');
const Tailwind = require('../Linters/Tailwind');
const ESLint = require('../Linters/ESLint');
const Stylelint = require('../Linters/Stylelint');
const TSLint = require('../Linters/TSLint');
const Prettier = require('../Linters/Prettier');

const OWN_DEPENDENCIES_MODULE = ['Router', 'HotReload', 'DemoStand', 'Tailwind'];

// TODO Пока мы не откажемся от сборки через jinnee придётся модули, которые указаны в сервисах живущих в sdk,
//  указываться явно.
const REQUIRED_DEPS_FROM_JINNEE = [
   'WS.Core',
   'Vdom',
   'Env',
   'EnvConfig',
   'EnvTouch',
   'ParametersLocalAPI',
   'ParametersWebAPI',
   'SbisEnv',
   'Application',
   'Types',
   'I18n',
   'LocalizationConfigs',
   'RequireJsLoader',
   'WasabyLoader',
   'Browser',
   'TransportCore',
   'Inferno',
   'React',
   'View',
   'UI',
   'Compiler',
   'UICommon',
   'UICore',
   'PresentationService',
   'PSWarmUp',
   'ThemesModule',
   'WmlBuilder',
   'VirtualTreeMarkup',
   'VirtualDom',
   'TextMarkup',
   'SbisEnvUI',
   'Markup',
   'Controls-default-theme',
   'Controls-icons',
   'Controls',
   'SbisUI',
   'BrowserAPI',
   'Feature',
   'FeatureLocal',
   'FeatureSubscriptionLocal'
];


/**
 * Проект, некий набор модулей, файлов, образующих целостное приложение.
 * @author Кудрявцев И.С.
 */
class Project {
   constructor(cfg) {
      this.options = cfg.options;
      this.repository = cfg.repository;
      this.name = this.repository.name || 'wasaby_cli_project';
      this.subsystemController = new SubsystemController(this.options);

      this._storeCache = pathUtils.join(this.options.get('store'), 'store.json');

      if (this.options.has('projectDir')) {
         this.service = new Service(pathUtils.join(this.options.get('projectDir'), 'InTestUI.s3srv'));
      }

      this.linters = new Map();
      this.errors = new Set();
      this.modules = new ModulesMap();
   }

   get store() {
      if (!this._store) {
         if (fs.pathExistsSync(this._storeCache)) {
            this._store = new Store(fs.readJsonSync(this._storeCache));
         } else {
            this._store = new Store();
         }
      }

      return this._store;
   }

   set store(store) {
      this._store = store;
   }

   get testController() {
      if (!this._testController) {
         const testedModules = this._getTestedModules();

         this._testController = new TestController(
            this.options.get('resources'),
            this.store.getDependentModules(testedModules, 'test', true),
            testedModules,
            this.options
         );
      }

      return this._testController;
   }

   /**
    * Инициализирует окружения для TypeScript
    * @returns {Promise<void>}
    */
   async initializeTSEnv() {
      logger.info('Creating tsconfig');

      const modules = this.store.modules.getModules();
      const ignorePaths = [
         this.options.get('resources'),
         this.options.get('builderCache'),
         this.options.get('artifactsDir'),
         this.options.get('store'),

         // TODO https://online.sbis.ru/opendoc.html?guid=a225f6b8-7993-48c7-8646-8fa863a65700&client=3
         pathUtils.join(pathUtils.dirname(this.options.get('builderCache')), 'typescript-cache')
      ];

      const commonConfig = new TSConfig({
         root: process.cwd(),
         exclude: ignorePaths,
         modules
      });
      const creatingConfig = [];

      for (const module of modules) {
         const config = new TSConfig({
            root: module.path,
            type: module.framework,
            pathParentConfig: commonConfig.path,
            include: [
               pathUtils.normalize(require.resolve('saby-typescript/wasabyGlobalTypings.d.ts'))
            ]
         });

         creatingConfig.push(config.save());
      }

      logger.info('Creating linters configurations');

      const tailwind = new Tailwind(this.store.getModule('Tailwind'));
      const stylelint = new Stylelint(ignorePaths);
      const lint = this.options.get('tslint') ? new TSLint() : new ESLint(commonConfig.path, ignorePaths);
      const prettier = new Prettier(ignorePaths);

      this.linters.set('ESLint', lint);
      this.linters.set('Stylelint', stylelint);
      this.linters.set('Prettier', prettier);

      await Promise.all([
         Promise.all(creatingConfig),
         commonConfig.save(),
         tailwind.init(),
         lint.init(),
         stylelint.init(),
         prettier.init()
      ]);
   }

   /**
    * Запускает линтер.
    * @param name {String} Имя линтера.
    * @param files {String[]} Список файлов по которым надо запустить линтер.
    * @returns {Promise<void>}
    */
   async startLinter(name, files) {
      const linter = this.linters.get(name);

      await linter.start(files);
   }

   /**
    * Загружает в локальное хранилище не достающие репозитории.
    * @returns {Promise<void>}
    */
   async load() {
      if (!fs.pathExistsSync(this.options.get('store'))) {
         fs.ensureDirSync(this.options.get('store'));
      }

      this.store = new Store();

      logger.info('Loading user repositories');

      await this.store.addRepos(this._getRequiredRepositories());

      logger.info('Detecting required repositories');

      const dependentModules = this._getTestedModules();

      logger.info('Loading  required repositories');

      await this.store.addRepos(this._getRepositoriesByModules(dependentModules));

      logger.info('Detecting dependent repositories');

      const modules = new Set([
         ...await this._getOwnModules(),
         ...this.store.getDependentModules(dependentModules, 'test', true),
         ...this.store.getDependentModules(dependentModules, 'demo', true),

         // TODO Убрать, когда научимся получать полный список модулей, а не использовать наш обрубок.
         ...(this.options.get('isLocaleProject') ? this._getRootModules() : []),
      ]);

      this.store.getDependenciesModules(modules);

      logger.info('Loading dependent repositories');

      await this.store.addRepos(this._getRepositoriesByModules(modules));

      await this.store.save(this._storeCache);
   }

   /**
    * Запускает watcher для компиляции файлов.
    * @param onChangeCallback {Function} Обработчик на срабатывания watcher-а.
    * @returns {Promise<void>}
    */
   async runWatcher(onChangeCallback) {
      if (this.builder) {
         await this.builder.watcher(onChangeCallback);
      }
   }

   /**
    * Запускает компиляцию файлов.
    * @returns {Promise<void>}
    */
   async build() {
      const Builder = this.options.get('buildTools') === 'jinnee' ? Jinnee : DefaultBuilder;

      logger.info('Detecting root modules');

      const testedModules = this._getTestedModules();

      const roots = new Set([
         ...await this._getOwnModules(),
         ...this.store.getDependentModules(testedModules, 'test', true),
         ...this.store.getDependentModules(testedModules, 'demo', true),
         ...this.store.getCDNModules(),

         // TODO Убрать, когда научимся получать полный список модулей, а не использовать наш обрубок.
         ...(this.options.get('isLocaleProject') ? this._getRootModules() : []),
      ]);

      logger.info('Detecting dependencies');

      this.store.getDependenciesModules(roots);

      this.modules.addModules(roots);

      if (this.errors.size !== 0) {
         throw new Error(`Preparing to build finish errors:\n${[...this.errors].join('\n')}`);
      }

      const tsconfig = new TSConfig({
         root: logger.dir,
         type: 'build'
      });

      await tsconfig.save();

      this.builder = new Builder(this.modules, this.options, tsconfig.path, this.service);

      await this.builder.build();
   }

   /**
    * Запускает юнит тесты.
    * @returns {Promise<void>}
    */
   async runUnitTests() {
      await this.testController.runUnitTest();
   }

   /**
    * Запускает браузерные тесты.
    * @returns {Promise<void>}
    */
   async runBrowserTests() {
      await this.startServer();

      await this.testController.runBrowserTest({
         port: this.server.port
      });

      await this.server.stop();
   }

   /**
    * Запускает сборки авто документации.
    * @returns {Promise<void>}
    */
   async buildAutoDoc() {
      await this.subsystemController.init('AutoDoc');

      const autoDoc = new AutoDoc(this.options, this.subsystemController);
      const testedModules = new Set(this._getTestedModules());

      this.store.getDependenciesModules(testedModules);

      await autoDoc.build(testedModules);
   }

   /**
    * Запускает демо стенд.
    * @returns {Promise<void>}
    */
   async startServer() {
      this.server = new Server(this.options);

      await this.server.start();
   }

   _getRequiredRepositories() {
      return new Set([
         ...this.options.get('repositories').filter({
            requireLoading: true
         }),
         ...this.options.get('repositories').getRepositories(this.options.get('rep'))
      ]);
   }

   _getRepositoriesByModules(modules) {
      const repositories = new Set();

      for (const module of modules) {
         if (typeof module.repository === 'string') {
            repositories.add(this.options.get('repositories').get(module.repository));
         } else {
            repositories.add(module.repository);
         }
      }

      return repositories;
   }

   async _getModulesFromService() {
      const result = new Set(this.store.getModules(REQUIRED_DEPS_FROM_JINNEE));
      const unknownModules = new Set();

      if (this.service) {
         await pMap(await this.service.getAllService(), async(service) => {
            for (const [name, module] of await service.getModules()) {
               if (!this.store.hasModule(name)) {
                  if (!pathUtils.isAbsolute(module.url)) {
                     module.url = pathUtils.join(pathUtils.dirname(service.path), module.url);
                  }

                  if (fs.pathExistsSync(module.url)) {
                     unknownModules.add(module);

                     continue;
                  }

                  this.errors.add(`Module "${name}" from ${service.path} didn't was found`);

                  continue;
               }

               result.add(this.store.getModule(name));
            }
         }, {
            concurrency: 10
         });
      }

      await pMap(unknownModules, async(module) => {
         if (!this.store.hasModule(module.name)) {
            const repository = new Repository({
               ...await Repository.getInfo(pathUtils.dirname(module.url)),
               freezeStateOfCommits: true,
               initialized: true
            });

            repository.HEAD = await repository.revParse('HEAD');

            await this.store.addRepos([repository]);
         }

         result.add(this.store.getModule(module.name));
      }, {
         concurrency: 1
      });

      return result;
   }

   async _getOwnModules() {
      return new Set([
         ...this.store.getModules(OWN_DEPENDENCIES_MODULE),
         ...await this._getModulesFromService()
      ]);
   }

   _getRootModules() {
      let rootModules = this.store.getModules(this.options.get('modules'));

      for (const repositoryName of this.options.get('rep')) {
         const repModules = this.store.getModulesByRepos(repositoryName, 'ui');

         for (const module of repModules) {
            if (this.options.get('modules').includes(module.name)) {
               repModules.clear();

               break;
            }
         }

         rootModules = [...rootModules, ...repModules];
      }

      return rootModules;
   }

   _getTestedModules() {
      const testedModules = this._getRootModules();

      if (this.options.get('dependentModules')) {
         return [...this.store.getDependentModules(testedModules), ...testedModules];
      }

      return testedModules;
   }
}

module.exports = Project;
