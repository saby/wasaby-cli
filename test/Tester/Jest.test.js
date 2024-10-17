const Test = require('../../src/Module/Test');
const JestExecutor = require('../../src/TestController/Executor/Jest');

function createExecutorConfig(cfg = {}, environment) {
   const options = createOptions(cfg.additionalOptions);
   const modules = createJestTestModules(cfg.additionalModules);

   const moduleName = 'JestUnitTests';
   const resultDir = '/example/results';

   return {
      processName: `${moduleName}_${environment}`,
      cacheDir: `${resultDir}/cache`,
      resultPath: `${resultDir}/${moduleName}/${environment}`,
      root: '/example/application',
      options,
      modules,
      environment
   };
}

function createOptions(additionalOptions = []) {
   return new Map([
      ...additionalOptions
   ]);
}

function createJestTestModules(additionalModules = []) {
   return new Set([
      new Test({
         name: 'First',
         repository: {
            name: 'FirstRep'
         },
         path: '/example/repositories/FirstRep/source',
         environment: 'NodeJS',
         framework: 'Jest'
      }),
      new Test({
         name: 'Second',
         repository: {
            name: 'SecondRep'
         },
         path: '/example/repositories/SecondRep/source',
         environment: 'JSDOM',
         framework: 'Jest'
      }),
      ...additionalModules
   ]);
}

function prepareToCheckConfig(jestConfig) {
   const removeNodeModules = id => {
      if (id.includes('node_modules')) {
         return 'node_modules' + id.split('node_modules').pop();
      }

      if (id.includes('TestController')) {
         return 'TestController' + id.split('TestController').pop();
      }

      return id;
   };

   // Replace environment dependable paths
   jestConfig.projects.forEach((project) => {
      project.setupFilesAfterEnv = project.setupFilesAfterEnv.map(removeNodeModules);
      project.testRunner = removeNodeModules(project.testRunner);
      project.runner = removeNodeModules(project.runner);

      return project.setupFilesAfterEnv;
   });

   jestConfig.reporters = jestConfig.reporters.map((reporter) => {
      if (!Array.isArray(reporter)) {
         return reporter;
      }

      return [removeNodeModules(reporter[0]), reporter[1]];
   });

   return jestConfig;
}

describe('Jest executor', () => {
   test('should return valid Jest configuration in JSDOM', async() => {
      const additionalOptions = [
         ['report', 'console']
      ];
      const cfg = createExecutorConfig({ additionalOptions }, 'JSDOM');
      const jestExecutor = new JestExecutor(cfg);
      jestExecutor.prepareConfig();

      prepareToCheckConfig(jestExecutor.jestConfig);

      expect(jestExecutor.snapshotResolverSource).toMatchSnapshot();
      expect(jestExecutor.jestConfig).toMatchSnapshot();
   });

   test('should return valid Jest configuration in NodeJS', async() => {
      const additionalOptions = [
         ['report', 'console']
      ];
      const cfg = createExecutorConfig({ additionalOptions }, 'NodeJS');
      const jestExecutor = new JestExecutor(cfg);
      jestExecutor.prepareConfig();

      prepareToCheckConfig(jestExecutor.jestConfig);

      expect(jestExecutor.snapshotResolverSource).toMatchSnapshot();
      expect(jestExecutor.jestConfig).toMatchSnapshot();
   });

   test('should return valid Jest configuration in Jenkins in JSDOM', async() => {
      const additionalOptions = [
         ['parallelNodeTest', '7'],
         ['parallelBrowserTest', '3'],
         ['timeoutTests', '120000'],
         ['report', 'xml']
      ];
      const cfg = createExecutorConfig({ additionalOptions }, 'JSDOM');
      const jestExecutor = new JestExecutor(cfg);
      jestExecutor.prepareConfig();

      prepareToCheckConfig(jestExecutor.jestConfig);

      expect(jestExecutor.snapshotResolverSource).toMatchSnapshot();
      expect(jestExecutor.jestConfig).toMatchSnapshot();
   });

   test('should return valid Jest configuration in Jenkins in NodeJS', async() => {
      const additionalOptions = [
         ['parallelNodeTest', '7'],
         ['parallelBrowserTest', '3'],
         ['timeoutTests', '120000'],
         ['report', 'xml']
      ];
      const cfg = createExecutorConfig({ additionalOptions }, 'NodeJS');
      const jestExecutor = new JestExecutor(cfg);
      jestExecutor.prepareConfig();

      prepareToCheckConfig(jestExecutor.jestConfig);

      expect(jestExecutor.snapshotResolverSource).toMatchSnapshot();
      expect(jestExecutor.jestConfig).toMatchSnapshot();
   });

   test('should use default coverage provider', async() => {
      const additionalOptions = [
         ['coverage', true]
      ];
      const cfg = createExecutorConfig({ additionalOptions }, 'NodeJS');
      const jestExecutor = new JestExecutor(cfg);
      jestExecutor.prepareConfig();

      prepareToCheckConfig(jestExecutor.jestConfig);

      expect(jestExecutor.snapshotResolverSource).toMatchSnapshot();
      expect(jestExecutor.jestConfig).toMatchSnapshot();
   });

   test('should use given coverage provider', async() => {
      const additionalOptions = [
         ['coverage', 'json']
      ];
      const cfg = createExecutorConfig({ additionalOptions }, 'NodeJS');
      const jestExecutor = new JestExecutor(cfg);
      jestExecutor.prepareConfig();

      prepareToCheckConfig(jestExecutor.jestConfig);

      expect(jestExecutor.snapshotResolverSource).toMatchSnapshot();
      expect(jestExecutor.jestConfig).toMatchSnapshot();
   });
});
