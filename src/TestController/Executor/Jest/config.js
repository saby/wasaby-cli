'use strict';

const os = require('os');

const pathUtils = require('../../../Utils/path');
const DEFAULT_REPORTER_PATH = pathUtils.normalize(require.resolve('./reporters/stdout.js'));
const DEFAULT_SUMMARY_REPORTER_PATH = pathUtils.normalize(require.resolve('./reporters/summary.js'));

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
   const coverageReporters = [];

   // FIXME: этой опции уже нет в Jest CLI >= 30
   if (options.has('coverageReporters')) {
      const reporters = options.get('coverageReporters');

      for (const reporter of reporters) {
         if (reporter === 'json') {
            coverageReporters.push(
               ['json', { 'file': 'coverage-final.json' }]
            );
         }

         if (reporter === 'clover' || reporter === 'lcov' || reporter === 'text' || reporter === 'html') {
            coverageReporters.push(
               [reporter]
            );
         }
      }

      return coverageReporters;
   }

   if (options.has('coverage') && options.get('coverage') === 'json') {
      return [['json', { 'file': 'coverage-final.json' }]];
   }

   return [['html']];
}

function getCoverageDirectory(reportDir, options) {
   if (!options.has('coverageDirectory')) {
      return pathUtils.join(reportDir, 'coverage');
   }

   return options.get('coverageDirectory');
}

function createProjectConfig(module, environment, cfg) {
   const isJsDom = environment === 'JSDOM';
   const jsdomEnvUrl = createUrl(cfg.staticServerPort);
   const roots = [
      pathUtils.join(cfg.root, module.name)
   ];

   if (cfg.options.get('onlyChangedFiles')) {
      for (const depName of Object.values(module.depends)) {
         roots.push(pathUtils.join(cfg.root, depName));
      }
   }

   return {
      displayName: `${module.name}_${environment}`,
      rootDir: cfg.root,
      roots,
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
         pathUtils.normalize(require.resolve('./environment/setupFilesAfterEnv.js')),
         // TODO это setup для нового require. Пока выключён, будем включать помодульно.
         //  Новый серверный require поностью синхроный и это привело к тому,
         //  что дермовые тесты, завязаные на тики, развалились, надо ходить и каждый тест исправлять ручками.
         // pathUtils.normalize(require.resolve('./environment/newRequireSetupFiles.js')),
      ],
      moduleNameMapper: {
         '\.css\.json\.js$': pathUtils.normalize(require.resolve('./css-json-mapper.js')),
         // TODO совместимость со старым require, удалить вместем с r.js
         '\.css\.json$': pathUtils.normalize(require.resolve('./css-json-mapper.js')),
         '^react$': pathUtils.join(cfg.root, 'React/third-party/v19/react/react.js'),
         '^react/jsx-runtime$': pathUtils.join(cfg.root, 'React/third-party/v19/react/jsx-runtime/react-jsx-runtime.js'),
         '^react/jsx-dev-runtime$': pathUtils.join(cfg.root, 'React/third-party/v19/react/jsx-dev-runtime/react-jsx-dev-runtime.js'),
         '^react-dom/test-utils$': pathUtils.join(cfg.root, 'React/third-party/v19/react-dom/test-utils/react-dom-test-utils.js'),
         '^react-dom/server$': pathUtils.join(cfg.root, 'React/third-party/v19/react-dom/server/react-dom-server.browser.js'),
         '^react-dom/client$': pathUtils.join(cfg.root, 'React/third-party/v19/react-dom/client/react-dom-client.js'),
         '^react-dom$': pathUtils.join(cfg.root, 'React/third-party/v19/react-dom/react-dom.js'),
         '^scheduler$': pathUtils.join(cfg.root, 'React/third-party/v19/scheduler/scheduler.js'),
         '^scheduler/unstable_mock$': pathUtils.join(cfg.root, 'React/third-party/v19/scheduler/scheduler-unstable_mock.js'),
         '^scheduler/unstable_post_task$': pathUtils.join(cfg.root, 'React/third-party/v19/scheduler/unstable_post_task.js'),
         '^@testing-library/react-hooks$': pathUtils.normalize(require.resolve('@testing-library/react')),
         '^jquery$': pathUtils.join(cfg.root, 'cdn/JQuery/jquery/3.3.1/jquery-min.js'),
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
   const reporters = [
      DEFAULT_REPORTER_PATH,
      [DEFAULT_SUMMARY_REPORTER_PATH, { summaryThreshold: 1 }]
   ];

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

function createJestConfiguration(cfg, modules) {
   const coverageDirectory = getCoverageDirectory(cfg.reportDir, cfg.options);
   const collectCoverageFrom = getCoverageModules(cfg);
   const coverageReporters = getCoverageReporters(cfg.options);
   const projects = [];

   for (const testModule of modules) {
      projects.push(createProjectConfig(
         testModule,
         testModule.environment,
         cfg
      ));
   }

   const maxWorkers = getMaxWorkers(cfg.options);

   return {
      projects,
      rootDir: cfg.root,
      collectCoverage: !!cfg.options.get('coverage'),
      coverageDirectory,
      collectCoverageFrom,
      coverageReporters,

      maxWorkers,
      workerIdleMemoryLimit: getWorkerIdleMemoryLimit(cfg.options, maxWorkers),
      testFailureExitCode: 1,
      testTimeout: 6000,

      reporters: getReportersConfig(cfg)
   };
}

module.exports = createJestConfiguration;
