const fs = require('fs-extra');

const TestController = require('../../src/TestController/TestController');
const Test = require('../../src/Module/Test');

function resolveExecutorEnvironment(framework, environment) {
   switch (framework) {
      case 'Jest':
         return framework;

      case 'WebDriverIO':
         return 'Browser';

      default:
         return environment;
   }
}

function buildOptions(options = {}) {
   const result = new Map();

   result.set('JSDOM', false);
   result.set('server', false);

   result.set('artifactsDir', 'src/logs');

   for (const [name, value] of Object.entries(options)) {
      result.set(name, value);
   }

   return result;
}

jest.mock('../../src/Utils/Logger', () => ({
   error: () => {},
   debug: () => {},
   info: () => {},
   writeFile: () => Promise.resolve(),
   dir: 'src/logs'
}));

describe('TestController', () => {
   describe('constructor()', () => {
      const defaultProperty = {
         root: 'build/application',
         unitTestEnvironment: '',
         resultDir: 'src/logs/UnitTests',
         executors: {},
         numberOfParallel: {
            NodeJS: 1,
            JSDOM: 1,
            Browser: 1,
            Jest: 1
         },
         runningTest: {}
      };

      function expectTestController(tester, expectProperty = {}) {
         const expectValues = { ...defaultProperty, ...expectProperty };

         expect(tester.root).toStrictEqual(expectValues.root);
         expect(tester.unitTestEnvironment).toStrictEqual(expectValues.unitTestEnvironment);
         expect(tester.resultDir).toStrictEqual(expectValues.resultDir);
         expect(tester.numberOfParallel).toEqual(expectValues.numberOfParallel);
         expect(tester.executors).toEqual(expectValues.executors);
      }

      test('should create default TestController', () => {
         const tester = new TestController('build/application', new Set([

         ]), [], buildOptions());

         expectTestController(tester);
      });

      test('should create TestController only JSDOM if option JSDOM true', () => {
         const tester = new TestController('build/application', new Set(), [], buildOptions({
            JSDOM: true
         }));

         expectTestController(tester, {
            unitTestEnvironment: 'JSDOM'
         });
      });

      test('should create TestController only JSDOM if option server true', () => {
         const tester = new TestController('build/application', new Set(), [], buildOptions({
            server: true
         }));

         expectTestController(tester, {
            unitTestEnvironment: 'JSDOM'
         });
      });

      test('should create TestController with parallel test for NodeJS if option parallelNodeTest exists', () => {
         const tester = new TestController('build/application', new Set(), [], buildOptions({
            parallelNodeJSTest: 2
         }));

         expectTestController(tester, {
            numberOfParallel: {
               NodeJS: 2,
               JSDOM: 1,
               Browser: 1,
               Jest: 1
            }
         });
      });

      test('should create TestController with parallel test for JSDOM if option parallelBrowserTest exists', () => {
         const tester = new TestController('build/application', new Set(), [], buildOptions({
            parallelJSDOMTest: 2
         }));

         expectTestController(tester, {
            numberOfParallel: {
               NodeJS: 1,
               JSDOM: 2,
               Browser: 1,
               Jest: 1
            }
         });
      });
   });

   describe('createExecutor()', () => {
      let tester;
      let stubConstructor;
      let stubLoadExecutor;

      class TestExecutor {
         constructor() {
            stubConstructor(...arguments);
         }
      }

      beforeEach(() => {
         stubConstructor = jest.fn(() => {});
         tester = new TestController('build/application', new Set(), [], buildOptions());
         stubLoadExecutor = jest.spyOn(TestController, 'loadExecutor').mockReturnValue(TestExecutor);
      });

      afterEach(() => {
         stubLoadExecutor.mockRestore();
      });

      test('should creat executor', () => {
         tester.createExecutor(
            'TestExecutor',
            'UnitModule',
            'NodeJS',
            ['module1', 'module2']
         );

         expect(stubConstructor.mock.calls.length).toStrictEqual(1);
         expect(stubConstructor.mock.calls[0][0]).toEqual({
            processName: 'UnitModule_NodeJS',
            cacheDir: 'src/logs/UnitTests/cache',
            resultPath: 'src/logs/UnitTests/UnitModule/NodeJS',
            root: 'build/application',
            environment: 'NodeJS',
            modules: ['module1', 'module2'],
            testedModules: [],
            options: new Map([
               ['JSDOM', false],
               ['server', false],
               ['artifactsDir', 'src/logs']
            ])
         });
      });
   });

   describe('initExecutors()', () => {
      let tester;
      let stubCreateExecutor;

      beforeEach(() => {
         tester = new TestController('build/application', new Set(), [], buildOptions());
         tester.executors = {};

         stubCreateExecutor = jest.spyOn(tester, 'createExecutor')
            .mockImplementation((framework, moduleName, environment, modules) => ({
               framework,
               moduleName,
               environment: resolveExecutorEnvironment(framework, environment),
               modules
            }));
      });

      afterEach(() => {
         stubCreateExecutor.mockRestore();
      });

      test('should init empty config if modules list is empty', () => {
         tester.modules = new Set();

         tester.initExecutors();

         expect(tester.executors).toEqual({});
      });

      test('should init JSDOM executor from all modules if property unitTestEnvironment is JSDOM', () => {
         const module = new Test({
            name: 'Module1',
            repository: {
               name: 'Rep'
            },
            environment: 'NodeJS',
            framework: 'Mocha'
         });

         tester.unitTestEnvironment = 'JSDOM';
         tester.modules = new Set([module]);
         tester.initExecutors();

         expect(tester.executors).toEqual({
            JSDOM: new Set([{
               framework: 'Mocha',
               moduleName: 'Module1',
               environment: 'JSDOM',
               modules: new Set([module])
            }])
         });
      });

      test('should init JSDOM and NodeJS executors if module should testing in NodeJS and JSDOM', () => {
         const module = new Test({
            name: 'Module1',
            repository: {
               name: 'Rep'
            },
            environment: 'NodeJS',
            framework: 'Mocha',
            needRunTestInBrowser: true
         });

         tester.modules = new Set([module]);
         tester.initExecutors();

         expect(tester.executors).toEqual({
            NodeJS: new Set([
               {
                  framework: 'Mocha',
                  moduleName: 'Module1',
                  environment: 'NodeJS',
                  modules: new Set([module])
               }
            ]),
            JSDOM: new Set([
               {
                  framework: 'Mocha',
                  moduleName: 'Module1',
                  environment: 'JSDOM',
                  modules: new Set([module])
               }
            ])
         });
      });

      test('should init NodeJS executors if testing environment is NodeJS', () => {
         const module1 = new Test({
            name: 'Module1',
            repository: {
               name: 'Rep1'
            },
            environment: 'NodeJS',
            framework: 'Mocha'
         });
         const module2 = new Test({
            name: 'Module2',
            repository: {
               name: 'Rep2'
            },
            environment: 'NodeJS',
            framework: 'Mocha'
         });

         tester.modules = new Set([module1, module2]);
         tester.initExecutors();

         expect(tester.executors).toEqual({
            NodeJS: new Set([
               {
                  framework: 'Mocha',
                  moduleName: 'Module1',
                  environment: 'NodeJS',
                  modules: new Set([module1])
               },
               {
                  framework: 'Mocha',
                  moduleName: 'Module2',
                  environment: 'NodeJS',
                  modules: new Set([module2])
               }
            ])
         });
      });

      test('should return Jest executor if module should will testing to Jest', () => {
         const module1 = new Test({
            name: 'Module1',
            repository: {
               name: 'Rep'
            },
            environment: 'NodeJS',
            framework: 'Jest'
         });

         tester.modules = new Set([module1]);
         tester.initExecutors();

         expect(tester.executors).toEqual({
            Jest: new Set([
               {
                  framework: 'Jest',
                  moduleName: 'Module1',
                  environment: 'Jest',
                  modules: new Set([module1])
               }
            ])
         });
      });
   });

   describe('mergeExecutors()', () => {
      let stubCreateExecutor;

      beforeEach(() => {
         stubCreateExecutor = jest.spyOn(TestController.prototype, 'createExecutor')
            .mockImplementation((framework, moduleName, environment, modules) => ({
               name: framework,
               framework,
               moduleName,
               environment: resolveExecutorEnvironment(framework, environment),
               modules
            }));
      });

      afterEach(() => {
         stubCreateExecutor.mockRestore();
      });

      test('should merge executors for NodeJS to one executor', () => {
         const modules = new Set([
            new Test({
               name: 'Module1',
               repository: {
                  name: 'Rep'
               },
               environment: 'NodeJS',
               framework: 'Mocha'
            }),
            new Test({
               name: 'Module2',
               repository: {
                  name: 'Rep'
               },
               environment: 'NodeJS',
               framework: 'Mocha'
            })
         ]);
         const tester = new TestController('build/application', modules, [], buildOptions());

         expect(tester.mergeExecutors(tester.executors)).toEqual({
            NodeJS: new Set([{
               name: 'Mocha',
               framework: 'Mocha',
               moduleName: 'Tests',
               environment: 'NodeJS',
               modules: modules
            }])
         });
      });

      test('should merge executors for Jest to one executor', () => {
         const modules = new Set([
            new Test({
               name: 'Module1',
               repository: {
                  name: 'Rep'
               },
               environment: 'NodeJS',
               framework: 'Jest'
            }),
            new Test({
               name: 'Module2',
               repository: {
                  name: 'Rep'
               },
               environment: 'JSDOM',
               framework: 'Jest'
            })
         ]);
         const tester = new TestController('build/application', modules, [], buildOptions());

         expect(tester.mergeExecutors(tester.executors)).toEqual({
            Jest: new Set([{
               name: 'Jest',
               framework: 'Jest',
               moduleName: 'Tests',
               environment: 'Jest',
               modules: modules
            }])
         });
      });

      test('should merge executors by environment', () => {
         const nodeJSModules = new Set([
            new Test({
               name: 'Module1',
               repository: {
                  name: 'Rep'
               },
               environment: 'NodeJS',
               framework: 'Mocha'
            }),
            new Test({
               name: 'Module2',
               repository: {
                  name: 'Rep'
               },
               environment: 'NodeJS',
               framework: 'Mocha'
            })
         ]);
         const JSDOMModules = new Set([
            new Test({
               name: 'Module3',
               repository: {
                  name: 'Rep'
               },
               environment: 'JSDOM',
               framework: 'Mocha'
            }),
            new Test({
               name: 'Module4',
               repository: {
                  name: 'Rep'
               },
               environment: 'JSDOM',
               framework: 'Mocha'
            })
         ]);
         const tester = new TestController(
            'build/application',
            new Set([...nodeJSModules, ...JSDOMModules]),
            [],
            buildOptions()
         );

         expect(tester.mergeExecutors(tester.executors)).toEqual({
            NodeJS: new Set([{
               name: 'Mocha',
               framework: 'Mocha',
               moduleName: 'Tests',
               environment: 'NodeJS',
               modules: nodeJSModules
            }]),
            JSDOM: new Set([{
               name: 'Mocha',
               framework: 'Mocha',
               moduleName: 'Tests',
               environment: 'JSDOM',
               modules: JSDOMModules
            }])
         });
      });
   });

   describe('getExecutors()', () => {
      let stubCreateExecutor;
      let stubMergeExecutor;

      beforeEach(() => {
         stubMergeExecutor = jest.spyOn(TestController.prototype, 'mergeExecutors').mockReturnValue({});
         stubCreateExecutor = jest.spyOn(TestController.prototype, 'createExecutor')
            .mockImplementation((framework, moduleName, environment, modules) => ({
               name: framework,
               framework,
               moduleName,
               environment: resolveExecutorEnvironment(framework, environment),
               modules
            }));
      });

      afterEach(() => {
         stubMergeExecutor.mockRestore();
         stubCreateExecutor.mockRestore();
      });

      test('should call merge executors if it is locale project', () => {
         const tester = new TestController('build/application', new Set(), [], buildOptions({
            isLocaleProject: true
         }));

         tester.getExecutors([]);

         expect(stubMergeExecutor.mock.calls.length).toStrictEqual(1);
      });

      test('should return executors only from NodeJS', () => {
         const JSDOMModules = new Set([
            new Test({
               name: 'Module3',
               repository: {
                  name: 'Rep'
               },
               environment: 'JSDOM',
               framework: 'Mocha'
            }),
            new Test({
               name: 'Module4',
               repository: {
                  name: 'Rep'
               },
               environment: 'JSDOM',
               framework: 'Mocha'
            })
         ]);
         const module1 = new Test({
            name: 'Module1',
            repository: {
               name: 'Rep'
            },
            environment: 'NodeJS',
            framework: 'Mocha'
         });
         const module2 = new Test({
            name: 'Module2',
            repository: {
               name: 'Rep'
            },
            environment: 'NodeJS',
            framework: 'Mocha'
         });
         const tester = new TestController(
            'build/application',
            new Set([module1, module2, ...JSDOMModules]),
            [],
            buildOptions()
         );

         expect(tester.getExecutors(['NodeJS'])).toEqual({
            NodeJS: new Set([
               {
                  name: 'Mocha',
                  framework: 'Mocha',
                  moduleName: 'Module1',
                  environment: 'NodeJS',
                  modules: new Set([module1])
               },
               {
                  name: 'Mocha',
                  framework: 'Mocha',
                  moduleName: 'Module2',
                  environment: 'NodeJS',
                  modules: new Set([module2])
               }
            ])
         });
      });
   });

   describe('runUnitTest()', () => {
      let stubOutputFileSync;
      let stubGetExecutor;
      let stubRunTests;
      let tester;

      beforeEach(() => {
         tester = new TestController('build/application', new Set(), [], buildOptions({
            workspace: 'build'
         }));

         stubOutputFileSync = jest.spyOn(fs, 'outputFileSync').mockReturnValue(Promise.resolve());
         stubGetExecutor = jest.spyOn(tester, 'getExecutors').mockReturnValue({
            JSDOM: ['JSDOMTest'],
            NodeJS: ['NodeJSTest']
         });
         stubRunTests = jest.spyOn(tester, 'runTests').mockReturnValue([null]);
      });

      afterEach(() => {
         stubOutputFileSync.mockRestore();
         stubGetExecutor.mockRestore();
         stubRunTests.mockRestore();
      });

      test('should detect executors and start tests', async() => {
         tester.modules = new Set(['NodeJS', 'JSDOM']);
         const expectedRunningTest = {
            JSDOM: ['JSDOMTest'],
            NodeJS: ['NodeJSTest']
         };

         await tester.runUnitTest();

         expect(stubGetExecutor.mock.calls.length).toStrictEqual(2);
         expect(stubGetExecutor.mock.calls[0][0]).toEqual(['NodeJS', 'JSDOM']);
         expect(stubGetExecutor.mock.calls[1][0]).toEqual(['Jest']);

         expect(stubRunTests.mock.calls.length).toStrictEqual(2);
         expect(stubRunTests.mock.calls[0][0]).toEqual(expectedRunningTest);
         expect(stubRunTests.mock.calls[1][1]).toHaveProperty('staticServerPort');
      });
   });
});
