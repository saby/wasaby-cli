'use strict';

const pathUtils = require('../../../Utils/path');

function createUrl(port) {
   const host = 'http://localhost';

   if (port) {
      return `${host}:${port}`;
   }

   return host;
}

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

function createJestConfiguration(cfg) {
   const coverageDir = pathUtils.join(cfg.reportDir, 'coverage');
   const projects = [];

   for (const [testModule] of cfg.modules.entries()) {
      projects.push(createProjectConfig(
         testModule,
         testModule.environment,
         cfg
      ));
   }

   const coverageModules = ['**/*.{js,jsx}'];
   if (cfg.options.get('isLocaleProject')) {
      coverageModules.pop();

      for (const module of cfg.testedModules) {
         coverageModules.push(`${module.name}/**/*.{js,jsx}`);
      }
   }

   return {
      projects,

      collectCoverage: !!cfg.options.get('coverage'),
      coverageDirectory: coverageDir,
      collectCoverageFrom: [
         ...coverageModules,
         '!**/node_modules/**',
         '!**/third-party/**'
      ],
      coverageReporters: getCoverageReporters(cfg.options),

      maxWorkers: getMaxWorkers(cfg.options),
      testFailureExitCode: 1,
      testTimeout: 6000,

      reporters: getReportersConfig(cfg)
   };
}

module.exports = createJestConfiguration;
