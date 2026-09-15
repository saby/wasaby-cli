const fs = require('fs-extra');

const pathUtils = require('../Utils/path');
const logger = require('../Utils/Logger');

const SubsystemController = require('../Utils/SubsystemController');
const Store = require('../ModuleManager/Store');
const ModuleManager = require('../ModuleManager/ModuleManager');
const Repository = require('./Repository');
const TSConfig = require('../TypeSript/Config');
const TestController = require('../TestController/TestController');
const Server = require('../Server/Server');

// Блок для команды buid
const SbisProject = require('./SbisProject');
const Jinnee = require('./Jinnee');
const DefaultBuilder = require('./Builder');

// Линтеры
const Tailwind = require('../Linters/Tailwind');
const Stylelint = require('../Linters/Stylelint');
const TSLint = require('../Linters/TSLint');
const ESLint = require('../Linters/ESLint');
const Prettier = require('../Linters/Prettier');
const TypesValidity = require('../Linters/TypesValidity');
const AmbiguousNames = require('../Linters/AmbiguousNames');

const DEFAULT_MODULES = [
   // Typescript
   '0e6a9dbb-14e5-4382-9430-b6e73a53dc79',
   // ThemeModules
   'f515eba2-dad5-4cc3-bef8-2ff45bd2a880',
   // SbisUI. Не должно здесь быть этой зависимости. Ждём когда выправят зависимости s3mod.
   '658445b8-42ed-4c6a-b649-c6ee7634ed66',
   // SitesEditor. Не должно здесь быть этой зависимости. Ждём когда выправят зависимости s3mod.
   '5b5cc7a4-d1b6-447a-a698-62f6e4a057dd'
];

const OWN_DEPENDENCIES_MODULE = [
   // HotReload
   'db97ce92-b7ce-4ff3-9649-dc43fd3c36bf',
   // DemoStand
   '0641abed-e0fb-4f42-990c-4c24bdbd7555',
   // Tailwind
   '6ae4f1d6-9ecf-4805-a98c-65e47906eedd',
   // FrameDemoStand
   'c1ab104e-8019-4fc9-8b12-de181a799e47',
   // JestTestingUtils
   '6608d2df-d0d2-479d-a1e8-ce07c7109b46',
];

const JINNEE_DEPENDENCIES_MODULE = [
   // PresentationService
   'fb94fd38-9965-46b6-9820-568d32c5f78e',
   // Intest
   '62bf645b-207a-4e83-b06d-40e9c36d3ab2',
];

const PROVIDER_FEATURE = [
   // FeatureLocale
   '09f73929-c09d-47c2-801f-2dc0cd428ef6',
   // FeatureSubscriptionLocal
   '1b8c399e-1f6e-4d28-aa5f-397980c0d02c',
   // ParametersLocalAPI
   '74e20c2f-4545-4210-9148-2d05b3cd12fc',
   // SAPLocal
   'ea4b5de5-cbbd-44c0-95d4-81a651c79559',
   // Controls-HistoryLocal
   'be6c53d7-f6a6-477f-8f50-0fee56315c6e',
   // AppUsageLocalLog
   '71030775-0e3d-421c-aa05-657261448775',
   // DefaultThemeController
   '4faefc42-6d2d-4c62-8a73-8de7ae255183',
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

      this.store = new Store(this.options.get('store'), this.options);

      this.linters = new Map();
      this.errors = new Set();
   }

   get SDKPath() {
      if (!this.options.get('projectDir')) {
         return '';
      }

      if (this.options.get('pathToSDK')) {
         return this.options.get('pathToSDK');
      }

      const sdkVersion = this.options.get('rc').replace('rc-', '').replace('.', '');
      const pathToSDK = process.env.SDK || process.env['SBISPlatformSDK_' + sdkVersion];

      if (!pathToSDK) {
         throw new Error(`${sdkVersion} SDK not installed`);
      }

      if (!fs.pathExistsSync(pathToSDK)) {
         throw new Error(`SDK does not exists on path "${pathToSDK}"`);
      }

      // Прокидываем значение в переменную, чтобы jinnee смог найти sdk.
      process.env['SBISPlatformSDK_' + sdkVersion] = pathToSDK;

      return pathToSDK;
   }

   get testController() {
      if (!this._testController) {
         const testableModules = this.getTestableModules();
         const testModules = this.getTestModules(testableModules, ['test']);

         this._testController = new TestController(
            this.options.get('resources'),
            new Set([...testModules.values()]),
            new Set([...testableModules.values()]),
            this.options
         );
      }

      return this._testController;
   }

   /**
    * Загружает в локальное хранилище не достающие репозитории.
    * @returns {Promise<void>}
    */
   async load() {
      if (this.options.get('protocol') === 'ssh') {
         await Repository.checkSSH();
      }

      const version = this.options.get('rc').replace('rc-', '');

      this.store.clear();

      // Проиндексируем корневые репы.
      await this.store.loadRepositories(this.options.get('rootReps'));
      // Грузим репозитории, которые были переданы --repositories с указанием ветки.
      await this.store.loadRepositories(this.options.get('repositories'));

      // Вычисляем модули, которые надо собрать-протестировать.
      const rootModules = this.getRootModules();
      const dependModules = new Map();


      // Если включён флаг найдём все модули которые зависят от тестируемых.
      if (this.options.get('dependentModules')) {
         const repositories = [];

         for (const url of Object.keys(this.store.whiteList || {})) {
            repositories.push(`${url}.git`);
         }

         const deptMod = await ModuleManager.getDependedModules(
            version,
            [...rootModules.keys()],
            repositories
         );

         for (const module of deptMod) {
            if (!this.store.whiteList) {
               dependModules.set(module.Id, module);

               continue;
            }

            const whiteListModule = this.store.whiteList[module.GitUrl.replace('.git', '')];

            if (whiteListModule.length !== 0) {
               if (whiteListModule.includes(module.Id)) {
                  dependModules.set(module.Id, module);
               }
            } else {
               dependModules.set(module.Id, module);
            }
         }
      }

      // Грузим зависимые модули.
      await this.store.loadModules(
         version,
         [
            ...OWN_DEPENDENCIES_MODULE,
            ...DEFAULT_MODULES,
            ...PROVIDER_FEATURE,
            ...(this.options.get('buildTools') === 'jinnee' ? JINNEE_DEPENDENCIES_MODULE : []),
            ...rootModules.values(),
            ...dependModules.keys(),
         ]
      );

      // Так как в хранилище могут быть настроены ограничения, отфильтруем зависимые модули,
      // чтобы остались только те, которые были добавлены в хранилище.
      for (const id of dependModules.keys()) {
         if (this.store.modules.has(id)) {
            dependModules.set(id, this.store.modules.get(id));
         } else {
            dependModules.delete(id);
         }
      }

      // Вычисляем и грузим модули с тестами и демками, которые зависят от тестируемых модулей.
      const testModules = this.getTestModules(new Map([...rootModules, ...dependModules]));

      await this.store.loadModules(
         version,
         [
            ...testModules.values()
         ]
      );

      const modules = new Map([
         ...this.getOwnModules(),
         ...rootModules,
         ...dependModules,
         ...testModules
      ]);

      // Делаем вызов построения дерева зависимостей, чтобы проверить его на целостность.
      let { errors, unknownModules } = this.store.getDependencies(modules);

      // Если при построении дерева зависимостей возникли неизвестные модули, попробуем их загрузить,
      // возможно это добавленные локально разработчиком зависимости.
      if (unknownModules.size !== 0) {
         await this.store.loadModules(
            version,
            [
               ...unknownModules
            ]
         );

         // Делаем повторные вызов построения дерева зависимостей,
         // чтобы проверить его на целостность, после дозагрузки неизвестных модулей.
         errors = this.store.getDependencies(modules).errors;
      }

      if (errors.size !== 0) {
         throw new Error(`The dependency tree is not solid. Errors: \n${[...errors].join('\n')}`);
      }

      await this.store.loadShortHashForModules();

      await this.store.save(rootModules);
   }

   /**
    * Запускает компиляцию файлов.
    * @returns {Promise<void>}
    */
   async build() {
      await this.store.lock();

      const Builder = this.options.get('buildTools') === 'jinnee' ? Jinnee : DefaultBuilder;

      logger.info('Detecting modules for build');

      const testableModules = this.getTestableModules();
      const rootModules = new Map([
         ...this.getOwnModules(),
         ...testableModules,
         ...this.getTestModules(testableModules),
         ...this.getCDNModules()
      ]);
      const { modules } = this.store.getDependencies(new Map([
         ...rootModules,
         // В графе могут быть модули фасады(featureRequired) требующие модули с реализациями(featureProvided).
         // Надо проверить, что такие модули есть, а если нет, попробовать восстановить.
         ...this.getNotResolveFeaturesModules(this.store.getDependencies(rootModules).modules)
      ]));
      const tsconfig = new TSConfig({
         root: logger.dir,
         type: 'build'
      });

      await tsconfig.save();

      if (this.options.has('projectDir')) {
         this.sbisProject = new SbisProject(
            pathUtils.join(this.options.get('projectDir'), 'InTest.s3cld'),
            this.SDKPath
         );
      }

      this.builder = new Builder(
         modules,
         this.options,
         tsconfig.path,
         PROVIDER_FEATURE,
         await this.getRouterMap(modules),
         this.sbisProject,
         this.SDKPath
      );

      await this.builder.build();
   }

   /**
    * Запускает watcher для компиляции файлов.
    * @param onChangeCallback {Function} Обработчик на срабатывания watcher-а.
    * @returns {Promise<void>}
    */
   async runWatcher(onChangeCallback) {
      if (!this.builder) {
         this.builder = new DefaultBuilder(this.options.get('resources'), this.options);
      }

      await this.builder.watcher(onChangeCallback);
   }

   /**
    * Запускает демо стенд.
    * @returns {Promise<void>}
    */
   async startServer() {
      this.server = new Server(this.options, {
         rootUrl: '/index.html'
      });

      await this.server.start();
   }

   /**
    * Запускает юнит тесты.
    * @returns {Promise<void>}
    */
   async runUnitTests() {
      await this.testController.runUnitTest();
   }

   /**
    * Запускает интеграционные тесты.
    * @returns {Promise<void>}
    */
   async runIntegrationTest() {
      await this.subsystemController.init('IntegrationTest');

      const integrationTest = this.subsystemController.get('IntegrationTest');

      await integrationTest.run();
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
    * Инициализирует окружения для TypeScript
    * @returns {Promise<void>}
    */
   async initializeTSEnv(options, ignore, root = process.cwd()) {
      logger.info('Creating tsconfig');

      const ignorePaths = ignore || [
         '**/third-party/',
         this.options.get('resources'),
         this.options.get('builderCache'),
         this.options.get('artifactsDir'),
         this.options.get('store'),
      ];

      const commonConfig = new TSConfig({
         root: root,
         exclude: ignorePaths,
         modules: this.store.modules.values()
      });
      const creatingConfig = [];

      for (const module of this.store.modules.values()) {
         if (module.path.includes(this.options.get('artifactsDir'))) {
            continue;
         }

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

      const tailwind = new Tailwind(this.store.modules.get('6ae4f1d6-9ecf-4805-a98c-65e47906eedd'), root);
      const stylelint = new Stylelint(ignorePaths, root);
      const lint = this.options.get('tslint') ? new TSLint() : new ESLint(options, commonConfig.path, ignorePaths, root);
      const prettier = new Prettier(ignorePaths, root);
      const typesValidity = new TypesValidity(ignorePaths, root);
      const ambiguousNames = new AmbiguousNames();

      this.linters.set('ESLint', lint);
      this.linters.set('Stylelint', stylelint);
      this.linters.set('Prettier', prettier);
      this.linters.set('TypesValidity', typesValidity);
      this.linters.set('AmbiguousNames', ambiguousNames);

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
    * Запускает сборки авто документации.
    * @returns {Promise<void>}
    */
   async buildAutoDoc() {
      // Подготовить инструмент сборки автодокументации
      await this.subsystemController.init('AutoDoc');

      const autoDoc = this.subsystemController.get('AutoDoc');

      // Подготовить набор целевых модулей и их зависимостей для сборки документации
      const targetModules = this.getTestableModules();
      const { modules } = this.store.getDependencies(targetModules);

      if (!this.options.get('dry')) {
         const markerFilePath = pathUtils.join(autoDoc.path, 'local-stand');
         const shouldRebuildStand = (
            !this.options.get('noStandRebuild') ||
            !fs.existsSync(markerFilePath)
         );

         if (shouldRebuildStand) {
            // Загружаем ресурсы стенда и выполняем сборку
            await fs.remove(markerFilePath);
            await autoDoc.loadStandSources();
            await autoDoc.buildStand();
            await fs.writeFile(markerFilePath, '', {
               encoding: 'utf-8'
            });
         }
      }

      // Загружаем участки Кайдзен и собираем данные для документации
      if (!this.options.get('noKaizenLoad')) {
         await autoDoc.tryLoadKaizen();
      }
      await autoDoc.build(new Set(Array.from(modules.values())));

      if (!this.options.get('dry')) {
         // Копируем пакет данных в ресурсы стенда
         await autoDoc.copyDataInUI();

         // Записываем файл с rc версией автодокументации
         await fs.outputFile(
            pathUtils.join(autoDoc.output, 'data_version.json'),
            JSON.stringify({
               version: autoDoc.version,
               date: new Date()
            })
         );

         // Запустить локальный стенд
         await autoDoc.startServer();
      }
   }

   /**
    * Возвращает модули, которые указаны пользователем как тестируемые.
    * @returns {Map<Module>}
    */
   getRootModules() {
      const filter = {
         repository: [...this.options.get('rootReps').keys()],
         type: ['ui']
      };
      const requiredModules = this.options.get('modules');

      if (requiredModules && requiredModules.length !== 0) {
         filter.name = requiredModules;
      }

      return this.store.getModules(filter);
   }

   /**
    * Возвращает модули, которые надо протестировать.
    * @returns {Map<Module>}
    */
   getTestableModules() {
      const rootModules = this.getRootModules();

      if (this.options.get('dependentModules')) {
         const dependedModules =  this.store.getDependedModules(rootModules);

         for (const [id, module] of rootModules) {
            dependedModules.set(id, module);
         }

         return dependedModules;
      }

      return rootModules;
   }

   /**
    * Возвращает модули с тестами и демками, которые зависят от тестируемых модулей.
    * @returns {Map<Module>}
    */
   getTestModules(modules, type = ['test', 'demo']) {
      const testModuleByDeps = this.store.getDependedModules(
         modules,
         {
            type
         },
         true
      );

      const requiredModules = this.options.get('modules');

      if (requiredModules && requiredModules.length !== 0) {
         const testModule = this.store.getModules({
            type,
            name: requiredModules
         });

         return new Map([...testModuleByDeps, ...testModule]);
      }

      return testModuleByDeps;
   }

   /**
    * Возвращает модули реализации, которых нет в графе, но они там требуется.
    * @param graph - граф для которого надо найти реализации.
    * @returns {Map<Module>}
    */
   getNotResolveFeaturesModules(graph) {
      const featuresRequired = new Set();
      const featuresProvided = new Set();

      for (const module of graph.values()) {
         if (module.featuresRequired) {
            for (const feature of module.featuresRequired.keys()) {
               featuresRequired.add(feature);
            }
         }

         if (module.featuresProvided) {
            for (const feature of module.featuresProvided.keys()) {
               featuresProvided.add(feature);
            }
         }
      }

      // Отсеиваем фичи, для которых в дереве уже есть реализации.
      for (const feature of featuresRequired) {
         if (featuresProvided.has(feature)) {
            featuresRequired.delete(feature);
         }
      }

      // Возвращаем только те модули, для которых в хранилище есть полное дерево зависимостей.
      return this.store.getModules({
         featuresProvided: [...featuresRequired],
         fullDepsTree: true,
      });
   }

   /**
    * Возвращает CDN модули.
    * @returns {Map<Module>}
    */
   getCDNModules() {
      return this.store.getModules({
         forCDN: [true]
      });
   }

   /**
    * Возвращает модули от которых зависит сам Wasaby-cli.
    * @returns {Map<Module>}
    */
   getOwnModules() {
      return this.store.getModules({
         id: [
            ...OWN_DEPENDENCIES_MODULE,
            ...DEFAULT_MODULES,
            ...PROVIDER_FEATURE,
            ...(this.options.get('buildTools') === 'jinnee' ? JINNEE_DEPENDENCIES_MODULE : []),
         ]
      })
   }

   async getRouterMap(modules) {
      let routerMap = {};

      for (const module of modules.values()) {
         if (module.type === 'demo') {
            const routerJsonPath = pathUtils.join(module.path, 'router.json');

            if (fs.existsSync(routerJsonPath)) {
               const router = await fs.readJSON(routerJsonPath);

               routerMap = {...routerMap, ...router};
            }
         }
      }

      return routerMap;
   }
}

module.exports = Project;
