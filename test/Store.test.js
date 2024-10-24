const fs = require('fs-extra');

const Store = require('../src/Store');
const ModulesMap = require('../src/Map/Modules');

jest.mock('../src/Utils/Logger', () => ({
   error: () => {},
   debug: () => {},
   info: () => {},
   writeFile: () => Promise.resolve(),
   dir: 'src/logs'
}));

function getCfgStore() {
   return {
      modules: {
         CDNModule1: {
            type: 'ui',
            id: '14',
            name: 'CDNModule1',
            s3mod: 'E:/store/Repository1/CDNModule1/CDNModule1.s3mod',
            path: 'E:/store/Repository1/CDNModule1',
            repository: 'Repository1',
            forCDN: true,
            depends: [],
            revision: null,
            isReact: undefined,
            required: undefined,
            featuresProvided: undefined,
            featuresRequired: undefined
         },
         Module1: {
            type: 'ui',
            id: '10',
            name: 'Module1',
            s3mod: 'E:/store/Repository1/Module1/Module1.s3mod',
            path: 'E:/store/Repository1/Module1',
            repository: 'Repository1',
            depends: [
               'Module3'
            ],
            forCDN: undefined,
            revision: null,
            isReact: undefined,
            required: undefined,
            featuresProvided: undefined,
            featuresRequired: undefined
         },
         UnitModule1: {
            type: 'test',
            id: '11',
            name: 'UnitModule1',
            s3mod: 'E:/store/Repository1/UnitModule1/UnitModule1.s3mod',
            path: 'E:/store/Repository1/UnitModule1',
            repository: 'Repository1',
            depends: [
               'Module1'
            ],
            forCDN: undefined,
            revision: null,
            isReact: undefined,
            required: undefined,
            featuresProvided: undefined,
            featuresRequired: undefined,
            environment: 'NodeJS',
            framework: 'Mocha',
            needRunTestInBrowser: false
         },
         DemoModule1: {
            type: 'demo',
            id: '12',
            name: 'DemoModule1',
            s3mod: 'E:/store/Repository1/DemoModule1/DemoModule1.s3mod',
            path: 'E:/store/Repository1/DemoModule1',
            repository: 'Repository1',
            depends: [
               'Module1'
            ],
            forCDN: undefined,
            revision: null,
            isReact: undefined,
            required: undefined,
            featuresProvided: undefined,
            featuresRequired: undefined
         },
         Module2: {
            type: 'ui',
            id: '20',
            name: 'Module2',
            s3mod: 'E:/store/Repository2/Module2/Module2.s3mod',
            path: 'E:/store/Repository2/Module2',
            repository: 'Repository2',
            depends: [
               'Module1'
            ],
            forCDN: undefined,
            revision: null,
            isReact: undefined,
            required: undefined,
            featuresProvided: undefined,
            featuresRequired: undefined
         },
         UnitModule2: {
            type: 'test',
            id: '21',
            name: 'UnitModule2',
            s3mod: 'E:/store/Repository2/UnitModule2/UnitModule2.s3mod',
            path: 'E:/store/Repository2/UnitModule2',
            repository: 'Repository2',
            depends: [
               'Module2'
            ],
            forCDN: undefined,
            revision: null,
            isReact: undefined,
            required: undefined,
            featuresProvided: undefined,
            featuresRequired: undefined,
            environment: 'NodeJS'
         },
         Module3: {
            type: 'ui',
            id: '30',
            name: 'Module3',
            s3mod: 'E:/store/Repository3/Module3/Module3.s3mod',
            path: 'E:/store/Repository3/Module3',
            repository: 'Repository3',
            depends: [],
            forCDN: undefined,
            revision: null,
            isReact: undefined,
            required: undefined,
            featuresProvided: undefined,
            featuresRequired: undefined
         }
      },
      repositories: {
         Repository1: {
            dir: 'E:/store',
            name: 'Repository1',
            url: 'https://git.sbis.ru/Repository1.git',
            path: 'E:/store/Repository1',
            HEAD: '1'
         },
         Repository2: {
            dir: 'E:/store',
            name: 'Repository2',
            url: 'https://git.sbis.ru/Repository2.git',
            path: 'E:/store/Repository2',
            HEAD: '2'
         },
         Repository3: {
            dir: 'E:/store',
            name: 'Repository3',
            url: 'https://git.sbis.ru/Repository3.git',
            path: 'E:/store/Repository3',
            HEAD: '3'
         },
      }
   };
}

describe('Store.js', () => {
   let cfg;
   let store;
   let stubExistsSync;

   beforeEach(() => {
      stubExistsSync = jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      cfg = getCfgStore();
      store = new Store(cfg);
   });

   afterEach(() => {
      stubExistsSync.mockRestore();
   });

   test('getCDNModules()', () => {
      const testResult = [...store.getCDNModules()];

      expect(testResult.length).toStrictEqual(1);
      expect(testResult[0]).toEqual(cfg.modules.CDNModule1);
   });

   test('serialize()', () => {
      const testResult = store.serialize();

      expect(Object.keys(testResult)).toEqual(['repositories', 'modules']);
   });

   describe('constructor()', () => {
      test('should create instance on default modules map', () => {
         const defaultStore = new Store({});

         expect(defaultStore.modules.has('Module1')).toBeFalsy();
      });

      test('should create instance on passed modules map', () => {
         const defaultStore = new Store({
            modules: {
               Module1: {
                  type: 'ui',
                  id: '10',
                  name: 'Module1',
                  repository: 'Repository1'
               }
            },
            repository: {
               Repository1: {
                  dir: 'E:/store',
                  name: 'Repository1',
                  url: 'https://git.sbis.ru/Repository1.git',
                  path: 'E:/store/Repository1',
                  HEAD: '1'
               }
            }
         });

         expect(defaultStore.modules.has('Module1')).toBeTruthy();
         expect(defaultStore.modules.get('Module1').isReact).toBeFalsy();
      });
   });

   describe('getModule()', () => {
      test('should return module "Module1"', () => {
         expect(store.getModule('Module1')).toEqual(cfg.modules.Module1);
      });

      test('should return module undefined', () => {
         expect(store.getModule('UnknownModule')).toBeUndefined();
      });
   });

   describe('hasModule()', () => {
      test('should return module true', () => {
         expect(store.hasModule('Module1')).toBeTruthy();
      });

      test('should return module false', () => {
         expect(store.hasModule('UnknownModule')).toBeFalsy();
      });
   });

   describe('getModules()', () => {
      test('should return module "Module1" and "Module2"', () => {
         const testResult = [...store.getModules(['Module1', 'Module2'])];

         expect(testResult.length).toStrictEqual(2);
         expect(testResult).toContainEqual(cfg.modules.Module1);
         expect(testResult).toContainEqual(cfg.modules.Module2);
      });

      test('should return only module "Module1"', () => {
         const testResult = [...store.getModules(['Module1', 'Module5'])];

         expect(testResult.length).toStrictEqual(1);
         expect(testResult).toContainEqual(cfg.modules.Module1);
      });
   });

   describe('getModulesByRepos()', () => {
      test('should return all modules were in repository "Repository1"', () => {
         const testResult = [...store.getModulesByRepos('Repository1')];

         expect(testResult.length).toStrictEqual(4);
         expect(testResult).toContainEqual(cfg.modules.Module1);
         expect(testResult).toContainEqual(cfg.modules.CDNModule1);
         expect(testResult).toContainEqual(cfg.modules.UnitModule1);
         expect(testResult).toContainEqual(cfg.modules.DemoModule1);
      });

      test('should return only unit-modules were in repository "Repository1"', () => {
         const testResult = [...store.getModulesByRepos('Repository1', 'test')];

         expect(testResult.length).toStrictEqual(1);
         expect(testResult).toContainEqual(cfg.modules.UnitModule1);
      });

      test('should return empty list if store not has this repository', () => {
         const testResult = [...store.getModulesByRepos('Repository0')];

         expect(testResult.length).toStrictEqual(0);
      });
   });

   describe('getDependenciesModules()', () => {
      test('should added module "Module3"', () => {
         const roots = new Set([cfg.modules.Module1]);
         store.getDependenciesModules(roots);

         const testResult = [...roots];

         expect(testResult.length).toStrictEqual(2);
         expect(testResult).toContainEqual(cfg.modules.Module1);
         expect(testResult).toContainEqual(cfg.modules.Module3);
      });

      test('should added module "Module1", "Module3"', () => {
         const roots = new Set([cfg.modules.Module2]);
         store.getDependenciesModules(roots);

         const testResult = [...roots];

         expect(testResult.length).toStrictEqual(3);
         expect(testResult).toContainEqual(cfg.modules.Module2);
         expect(testResult).toContainEqual(cfg.modules.Module1);
         expect(testResult).toContainEqual(cfg.modules.Module3);
      });
   });

   describe('getDependentModules()', () => {
      test('should return all modules have dependency to module "Module 1"', () => {
         const testResult = [...store.getDependentModules(new Set([cfg.modules.Module1]))];

         expect(testResult.length).toStrictEqual(3);
         expect(testResult).toContainEqual(cfg.modules.Module2);
         expect(testResult).toContainEqual(cfg.modules.UnitModule1);
         expect(testResult).toContainEqual(cfg.modules.DemoModule1);
      });

      test('should return modules have dependency to module "Module 1" and were in one repository with it', () => {
         const testResult = [...store.getDependentModules(new Set([cfg.modules.Module1]), undefined, true)];

         expect(testResult.length).toStrictEqual(2);
         expect(testResult).toContainEqual(cfg.modules.UnitModule1);
         expect(testResult).toContainEqual(cfg.modules.DemoModule1);
      });

      test('should return all unit-modules have dependency to module "Module 1"', () => {
         const testResult = [...store.getDependentModules(new Set([cfg.modules.Module1]), 'test')];

         expect(testResult.length).toStrictEqual(1);
         expect(testResult).toContainEqual(cfg.modules.UnitModule1);
      });
   });

   describe('addRepos()', () => {
      test('should modules from new repository', () => {
         const fakeRepository = {
            name: 'fakeRepository',
            init: () => Promise.resolve(),
            checkoutByStrategy: () => Promise.resolve(),
            revParse: () => Promise.resolve('0000'),
            detectCheckoutStrategy: () => Promise.resolve({}),
            getModules: () => new ModulesMap({
               fakeModule: {
                  type: 'ui',
                  name: 'fakeModule',
                  id: '888'
               }
            })
         };

         return store.addRepos(new Set([fakeRepository])).then(() => {
            const fakeModule = store.newModules.get('fakeModule');

            expect(fakeModule).not.toBeUndefined();
            expect(fakeModule.name).toStrictEqual('fakeModule');
            expect(fakeModule.id).toStrictEqual('888');
            expect(fakeModule.isReact).toBeFalsy();

            const fakeModuleInStore = store.modules.get('fakeModule');

            expect(fakeModuleInStore).not.toBeUndefined();
            expect(fakeModuleInStore.name).toStrictEqual('fakeModule');
            expect(fakeModuleInStore.id).toStrictEqual('888');
            expect(fakeModuleInStore.isReact).toBeFalsy();

            const fakeRep = store.repositories.get('fakeRepository');

            expect(fakeRep).not.toBeUndefined();
            expect(fakeRep.name).toStrictEqual('fakeRepository');
            expect(fakeRep.HEAD).toStrictEqual('0000');
         });
      });

      test('should ignore modules from already repository is in store', () => {
         const fakeRepository = {
            name: 'Repository1',
            init: () => Promise.resolve(),
            checkoutByStrategy: () => Promise.resolve(),
            revParse: () => Promise.resolve('0000'),
            detectCheckoutStrategy: () => Promise.resolve({}),
            getModules: () => new ModulesMap({
               fakeModule: {
                  type: 'ui',
                  name: 'fakeModule',
                  id: '888'
               }
            })
         };

         return store.addRepos(new Set([fakeRepository])).then(() => {
            expect(store.newModules.get('fakeModule')).toBeUndefined();
            expect(store.modules.get('fakeModule')).toBeUndefined();
         });
      });
   });

   describe('save()', () => {
      let stubOutputFile;

      beforeEach(() => {
         stubOutputFile = jest.spyOn(fs, 'outputFile').mockReturnValue(Promise.resolve());
      });

      afterEach(() => {
         stubOutputFile.mockRestore();
      });

      test('should save new modules in main store', async() => {
         store.newModules = new ModulesMap({
            fakeModule: {
               type: 'ui',
               name: 'NewModule',
               id: '888',
               repository: 'rep'
            }
         });

         await store.save('src/log/meta.json');

         expect(store.modules.all.size).toStrictEqual(1);
         expect(store.modules.has('NewModule')).toBeTruthy();
      });

      test('should write module and repositories in meta-file', async() => {
         store.newModules = new ModulesMap({
            fakeModule: {
               type: 'ui',
               name: 'NewModule',
               id: '888',
               repository: 'rep'
            }
         });

         await store.save('src/log/meta.json');

         expect(stubOutputFile.mock.calls.length).toStrictEqual(1);
         expect(stubOutputFile.mock.calls[0][0]).toStrictEqual('src/log/meta.json');
         expect(stubOutputFile.mock.calls[0][1]).toEqual(JSON.stringify(store.serialize(), null, 3));
      });
   });
});
