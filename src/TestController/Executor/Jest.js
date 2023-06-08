const fs = require('fs-extra');

const pathUtils = require('../../Utils/path');
const Executor = require('./Executor');
const logger = require('../../Utils/Logger');

// TODO Jest на 16-ом Node.js текут воркеры и выжирают всю память на тачке отправляя её в обморок.
//  Пришлось ограничить потребления памяти через опцию node-ы, но это привело к увеличению времени прохождения тестов.
//  Поэтому поднимаем таймаут до 8 минут.
//  https://github.com/facebook/jest/issues/11956
const TIMEOUT_PER_PROJECT = 480_000;
const TIMEOUT_PER_PROJECT_COVERAGE = 3_600_000;

function getMaxWorkers(options) {
   // Because of the high CPU and RAM usage (Jest is a resource eater!)
   // we detect execution in Jenkins with the following parameters
   // and limit Jest using maxWorkers with 1/5 of available CPU cores.
   const shouldMinimizeWorkers = (
      options.has('parallelNodeTest') ||
      options.has('parallelBrowserTest') ||
      options.has('coverage')
   );

   if (shouldMinimizeWorkers) {
      return '20%';
   }

   return '50%';
}

function getCoverageReporters(options) {
   if (options.has('coverage') && options.get('coverage') === 'json') {
      return [['json', { 'file': 'coverage-final.json' }]];
   }

   return [['html', { 'subdir': 'coverage' }]];
}

function getTestPathForConsistencyCheck(config) {
   const component = 'Component/index.js';

   if (config.BUILD_MODULES.length > 0) {
      // We have to use known path for test check
      return pathUtils.join(
         config.BUILD_MODULES[0].slice(1, -1), component
      );
   }

   return pathUtils.join(config.ROOT, 'DemoStand', component);
}

function generateSnapshotResolverSource(snapshotResolverConfig) {
   const snapshotResolver = fs.readFileSync(pathUtils.join(__dirname, 'templates/snapshotsResolver.js'), 'utf-8');
   const TEST_PATH_FOR_CONSISTENCY_CHECK = getTestPathForConsistencyCheck(snapshotResolverConfig);

   return snapshotResolver
      .replace('/* #SOURCE_MODULES# */', snapshotResolverConfig.SOURCE_MODULES.join())
      .replace('/* #BUILD_MODULES# */', snapshotResolverConfig.BUILD_MODULES.join())
      .replace('/* #TEST_PATH_FOR_CONSISTENCY_CHECK# */', TEST_PATH_FOR_CONSISTENCY_CHECK);
}

class Jest extends Executor {
   constructor(cfg) {
      super(cfg);

      this.name = 'Jest';
      this.processName = `${this.processName}_jest`;
      this.environment = this.name;
      this.timeout = this._getProcessTimeout();

      this.jestConfigPath = pathUtils.join(cfg.resultPath, 'jestConfig.json');
      this.unitsConfigPath = pathUtils.join(cfg.resultPath, 'unitsConfig.json');
      this.snapshotResolverPath = pathUtils.join(cfg.resultPath, 'snapshot-resolver.js');

      this._initJestConfig(cfg);
      this._initUnitsConfig();
      this._initSnapshotResolver();
   }

   async run() {
      await this.saveConfig();
      await this.cleanReportDir();

      logger.info('Start unit testing under JEST', this.processName);
      await this.startNodeJS();

      logger.info('Recording report unit tests', this.processName);

      await this._checkReports();
      await this._writeErrors();

      logger.info('Unit testing is end', this.processName);
   }

   async startNodeJS() {
      try {
         await this.cmd.spawn(
            {
               file: this.path,
               args: {
                  jest: true,
                  silent: this.report === 'xml',
                  unitsConfigPath: this.unitsConfigPath
               }
            },
            {
               processName: this.processName,
               timeout: this.timeout,
               silent: this.report === 'xml',
               errorFilter: this.errorFilter,
               env: {
                  ...process.env,
                  COLORS: this.report !== 'xml'
               },
            }
         );
      } catch (errors) {
         this.errors = errors;

         return;
      }

      this.errors = this.cmd.getErrorsByName(this.processName);
   }

   saveConfig() {
      return Promise.all([
         this._saveJestConfig(),
         this._saveUnitsConfig(),

         // TODO Можно вызвать один раз, но только переда запуском всех тестов, когда уже известны все юниты для jesta.
         this._saveSnapshotResolver()
      ]);
   }

   _getProcessTimeout() {
      if (this.options.get('isLocaleProject')) {
         return 0;
      }

      if (this.options.get('coverage')) {
         return TIMEOUT_PER_PROJECT_COVERAGE;
      }

      return TIMEOUT_PER_PROJECT;
   }

   _initJestConfig(cfg) {
      const coverageDir = pathUtils.join(cfg.resultPath, 'coverage');
      const projects = [];

      for (const [testModule] of cfg.modules.entries()) {
         projects.push(this._createProjectConfig(testModule, testModule.environment, cfg.cacheDir));
      }

      this.jestConfig = {
         projects,

         collectCoverage: !!this.options.get('coverage'),
         coverageDirectory: coverageDir,
         collectCoverageFrom: [
            '**/*.{js,jsx}',
            '!**/node_modules/**',
            '!**/third-party/**'
         ],
         coverageReporters: getCoverageReporters(cfg.options),

         maxWorkers: getMaxWorkers(cfg.options),
         testFailureExitCode: 1,
         testTimeout: 6000,

         reporters: this._getReportersConfig()
      };
   }

   _getReportersConfig() {
      const reporters = ['default'];

      if (this.report !== 'xml') {
         return reporters;
      }

      const separator = '›';

      reporters.push([
         pathUtils.join(pathUtils.dirname(this.path), 'lib/jest/reporter.js'),
         {
            suiteName: 'Jest Unit Tests',
            outputFile: this.reportPath,
            includeConsoleOutput: 'true',
            ancestorSeparator: ` ${separator} `,
            suiteNameTemplate: ` ${separator} {filepath}`,
            classNameTemplate: '.{classname}',
            titleTemplate: '{title}'
         }
      ]);

      return reporters;
   }

   _saveJestConfig() {
      return fs.outputFile(
         this.jestConfigPath,
         JSON.stringify(this.jestConfig, null, 3)
      );
   }

   _initUnitsConfig() {
      this.unitsConfig = {
         jest: {
            options: this._getJestCliOptions(),
            root: this.root,
            configPath: this.jestConfigPath,
            junitEnabled: this.report === 'xml'
         },
         envVariables: { }
      };
   }

   _getJestCliOptions() {
      const cliOptions = {
         ci: !this.options.get('updateSnapshot'),
         updateSnapshot: this.options.get('updateSnapshot')
      };

      for (const [name, value] of this.options) {
         if (cliOptions.hasOwnProperty(name)) {
            continue;
         }

         cliOptions[name] = value;
      }

      return cliOptions;
   }

   _saveUnitsConfig() {
      return fs.outputFile(
         this.unitsConfigPath,
         JSON.stringify(this.unitsConfig, null, 3)
      );
   }

   _initSnapshotResolver() {
      const snapshotResolverConfig = {
         SOURCE_MODULES: [],
         BUILD_MODULES: [],
         ROOT: this.root
      };

      for (const module of this.modules) {
         const buildPath = pathUtils.join(this.root, module.name);

         snapshotResolverConfig.BUILD_MODULES.push(`'${buildPath}'`);
         snapshotResolverConfig.SOURCE_MODULES.push(`'${module.path}'`);
      }

      this.snapshotResolverSource = generateSnapshotResolverSource(snapshotResolverConfig);
   }

   _saveSnapshotResolver() {
      return fs.outputFile(
         this.snapshotResolverPath,
         this.snapshotResolverSource
      );
   }

   _createProjectConfig(module, environment, cacheDirectory) {
      const isJsDom = environment === 'JSDOM';

      return {
         displayName: `${module.name}_${environment}`,
         rootDir: this.root,
         roots: [
            pathUtils.join(this.root, module.name)
         ],
         moduleDirectories: [
            'node_modules',
            this.root
         ],
         testMatch: [
            '**/*.test.js'
         ],

         testRunner: pathUtils.join(pathUtils.dirname(this.path), 'lib/jest/testRunner.js'),

         setupFilesAfterEnv: [
            pathUtils.join(pathUtils.dirname(this.path), 'lib/jest/setup-umd.js')
         ],
         moduleNameMapper: {
            'react-dom/test-utils': pathUtils.join(this.root, 'React/third-party/react-dom/test-utils/react-dom-test-utils.development.js'),
            'react-dom/server': pathUtils.join(this.root, 'React/third-party/react-dom/server/react-dom-server.browser.development.js'),
            'react-dom': pathUtils.join(this.root, 'React/third-party/react-dom/react-dom.development.js')
         },
         globals: {
            __SABY_APPLICATION_DIRECTORY__: this.root,
            __SABY_LOAD_CSS__: isJsDom
         },
         snapshotResolver: this.snapshotResolverPath,
         testEnvironment: isJsDom ? 'jsdom' : 'node',
         testEnvironmentOptions: {
            pretendToBeVisual: true,
            contentType: 'text/html',
            includeNodeLocations: true,
            storageQuota: 10000000,
            runScripts: 'dangerously',
            resources: 'usable'
         },

         transform: { },

         errorOnDeprecated: false,
         slowTestThreshold: 5,

         automock: false,
         clearMocks: false,
         resetMocks: false,
         resetModules: false,
         restoreMocks: true,

         cacheDirectory: pathUtils.join(cacheDirectory, 'jest')
      };
   }
}

module.exports = Jest;
