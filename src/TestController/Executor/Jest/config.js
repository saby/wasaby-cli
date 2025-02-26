'use strict';

const os = require('os');

const pathUtils = require('../../../Utils/path');

function createUrl(port) {
   const host = 'http://localhost';

   if (port) {
      return `${host}:${port}`;
   }

   return host;
}

function getCpusNumber() {
   if (typeof os.availableParallelism === 'function') {
      return os.availableParallelism();
   }

   return os.cpus().length;
}

function toSafeNumber(value) {
   const number = Number.parseFloat(value);

   if (Number.isFinite(number)) {
      return number;
   }

   return value;
}

function getMaxWorkers(options) {
   if (options.has('maxWorkers') && options.has('workerIdleMemoryLimit')) {
      // Пользовательский параметр maxWorkers задается вместе с workerIdleMemoryLimit
      const value = options.get('maxWorkers');

      if (value.endsWith('%')) {
         return value;
      }
      
      return toSafeNumber(value);
   }
   
   // Because of the high CPU and RAM usage (Jest is a resource eater!)
   // we detect execution in Jenkins with the following parameters
   // and limit Jest using maxWorkers with 1/5 of available CPU cores.
   const cpus = getCpusNumber();

   if (options.has('coverage')) {
      // Для сборки покрытия используем 20% допустимых ядер
      return Math.max(Math.floor(0.2 * (cpus - 1)), 1);
   }

   // Для тестирования используем 50% допустимых ядер
   return Math.max(Math.floor(0.5 * (cpus - 1)), 1);
}

function getWorkerIdleMemoryLimit(options, maxWorkers) {
   if (options.has('maxWorkers') && options.has('workerIdleMemoryLimit')) {
      // Пользовательский параметр workerIdleMemoryLimit задается вместе с maxWorkers
      const value = options.get('workerIdleMemoryLimit');

      if (/[KMG](iB|B)?$/g.test(value)) {
         return value;
      }

      return toSafeNumber(value);
   }

   // Для каждого воркера выделяем равную порцию памяти, чтобы сумма этих порций давала 8ГБ
   const memory = 8 * 1024;

   return `${Math.floor(memory / maxWorkers)}MB`;
}

function getCoverageReporters(options) {
   if (options.has('coverage') && options.get('coverage') === 'json') {
      return [['json', { 'file': 'coverage-final.json' }]];
   }

   return [['html']];
}

function createProjectConfig(module, environment, cfg) {
   const isJsDom = environment === 'JSDOM';
   const jsdomEnvUrl = createUrl(cfg.staticServerPort);

   return {
      displayName: `${module.name}_${environment}`,
      rootDir: cfg.root,
      roots: [
         pathUtils.join(cfg.root, module.name)
      ],
      moduleDirectories: [
         'node_modules',
         cfg.root
      ],
      testMatch: [
         '**/*.test.js'
      ],

      testRunner: pathUtils.normalize(require.resolve('./testRunner.js')),
      runner: pathUtils.normalize(require.resolve('./Runner.js')),
      setupFilesAfterEnv: [
         pathUtils.normalize(require.resolve('./environment/setupFilesAfterEnv.js'))
      ],
      moduleNameMapper: {
         'react-dom/test-utils': pathUtils.join(cfg.root, 'React/third-party/react-dom/test-utils/react-dom-test-utils.development.js'),
         'react-dom/server': pathUtils.join(cfg.root, 'React/third-party/react-dom/server/react-dom-server.browser.development.js'),
         'react-dom': pathUtils.join(cfg.root, 'React/third-party/react-dom/react-dom.development.js')
      },
      globals: {
         __SABY_APPLICATION_DIRECTORY__: cfg.root,
         __SABY_LOAD_CSS__: isJsDom
      },
      snapshotResolver: cfg.snapshotResolverPath,
      snapshotFormat: {
         escapeString: true,
         printBasicPrototype: true
      },
      testEnvironment: isJsDom ? 'jsdom' : 'node',
      testEnvironmentOptions: {
         pretendToBeVisual: true,
         contentType: 'text/html',
         includeNodeLocations: true,
         storageQuota: 10000000,
         runScripts: 'dangerously',
         resources: 'usable',
         url: jsdomEnvUrl,
         referrer: jsdomEnvUrl,
      },

      transform: { },

      errorOnDeprecated: false,
      slowTestThreshold: 5,

      automock: false,
      clearMocks: true,
      resetMocks: false,
      resetModules: false,
      restoreMocks: true,

      cacheDirectory: pathUtils.join(cfg.cacheDir, 'jest')
   };
}

function getReportersConfig(cfg) {
   const reporters = ['default'];

   if (cfg.report !== 'xml') {
      return reporters;
   }

   const separator = '›';

   reporters.push([
      pathUtils.normalize(require.resolve('./reporter.js')),
      {
         suiteName: 'Jest Unit Tests',
         outputFile: cfg.reportPath,
         includeConsoleOutput: 'true',
         ancestorSeparator: ` ${separator} `,
         suiteNameTemplate: ` ${separator} {filepath}`,
         classNameTemplate: '.{classname}',
         titleTemplate: '{title}'
      }
   ]);

   return reporters;
}

function getCoverageModules(cfg) {
   // По умолчанию собираем покрытие из всех доступных исходников
   const collectCoverageFrom = [
      '**/*.{js,jsx}',
      '!**/node_modules/**',
      '!**/third-party/**'
   ];

   if (!cfg.testedModules) {
      return collectCoverageFrom;
   }

   const collectCoverageFromModules = [];
   for (const module of cfg.testedModules) {
      collectCoverageFromModules.push(`${module.name}/**/*.{js,jsx}`);
   }

   if (collectCoverageFromModules.length === 0) {
      return collectCoverageFrom;
   }

   // Если при запуске тестов были указаны тестируемые модули,
   // то покрытие собираем из исходников указанных модулей
   collectCoverageFrom.shift();
   collectCoverageFrom.unshift(...collectCoverageFromModules);

   return collectCoverageFrom;
}

function createJestConfiguration(cfg) {
   const coverageDirectory = pathUtils.join(cfg.reportDir, 'coverage');
   const collectCoverageFrom = getCoverageModules(cfg);
   const projects = [];

   for (const [testModule] of cfg.modules.entries()) {
      projects.push(createProjectConfig(
         testModule,
         testModule.environment,
         cfg
      ));
   }

   const maxWorkers = getMaxWorkers(cfg.options);

   return {
      projects,

      collectCoverage: !!cfg.options.get('coverage'),
      coverageDirectory,
      collectCoverageFrom,
      coverageReporters: getCoverageReporters(cfg.options),

      maxWorkers,
      workerIdleMemoryLimit: getWorkerIdleMemoryLimit(cfg.options, maxWorkers),
      testFailureExitCode: 1,
      testTimeout: 6000,

      reporters: getReportersConfig(cfg)
   };
}

module.exports = createJestConfiguration;
