const ModulesMap = require('../../src/Map/Modules');

function getNamesModules(modules) {
   const result = [];

   for (const module of modules) {
      result.push(module.name);
   }

   return result;
}

describe('ModulesMap', () => {
   const modules = {
      UIModule: {
         type: 'ui',
         name: 'UIModule',
         repository: 'Repository'
      },
      DemoModule: {
         type: 'demo',
         name: 'DemoModule',
         repository: 'Repository'
      },
      UnitModule: {
         type: 'test',
         name: 'UnitModule',
         repository: 'Repository'
      }
   };
   let modulesMap;

   beforeEach(() => {
      modulesMap = new ModulesMap(modules);
   });

   describe('constructor()', () => {
      test('should create empty map', () => {
         const localeModulesMap = new ModulesMap();

         expect(localeModulesMap.all.size).toStrictEqual(0);
         expect(localeModulesMap.ui.size).toStrictEqual(0);
         expect(localeModulesMap.test.size).toStrictEqual(0);
         expect(localeModulesMap.demo.size).toStrictEqual(0);
      });

      test('should create modules map by passed list', () => {
         const localeModulesMap = new ModulesMap({
            UIModule: {
               type: 'ui',
               name: 'UIModule'
            },
            DemoModule: {
               type: 'demo',
               name: 'DemoModule'
            },
            UnitModule: {
               type: 'test',
               name: 'UnitModule',
               repository: {
                  name: 'rep'
               }
            }
         });

         expect(localeModulesMap.all.size).toStrictEqual(3);
         expect(localeModulesMap.ui.size).toStrictEqual(1);
         expect(localeModulesMap.test.size).toStrictEqual(1);
         expect(localeModulesMap.demo.size).toStrictEqual(1);
      });
   });

   describe('get()', () => {
      describe('ui', () => {
         test('should return ui module', () => {
            expect(modulesMap.get('UIModule').name).toStrictEqual('UIModule');
            expect(modulesMap.get('UIModule', 'ui').name).toStrictEqual('UIModule');
         });

         test('should return undefined', () => {
            expect(modulesMap.get('UIModule', 'test')).toBeUndefined();
            expect(modulesMap.get('UIModule', 'demo')).toBeUndefined();
         });
      });

      describe('unit', () => {
         test('should return ui module', () => {
            expect(modulesMap.get('UnitModule').name).toStrictEqual('UnitModule');
            expect(modulesMap.get('UnitModule', 'test').name).toStrictEqual('UnitModule');
         });

         test('should return undefined', () => {
            expect(modulesMap.get('UnitModule', 'ui')).toBeUndefined();
            expect(modulesMap.get('UnitModule', 'demo')).toBeUndefined();
         });
      });

      describe('demo', () => {
         test('should return ui module', () => {
            expect(modulesMap.get('DemoModule').name).toStrictEqual('DemoModule');
            expect(modulesMap.get('DemoModule', 'demo').name).toStrictEqual('DemoModule');
         });

         test('should return undefined', () => {
            expect(modulesMap.get('DemoModule', 'ui')).toBeUndefined();
            expect(modulesMap.get('DemoModule', 'test')).toBeUndefined();
         });
      });
   });

   describe('getModules()', () => {
      test('should return all modules if arguments is not passed', () => {
         const testedResult = modulesMap.getModules();

         expect(testedResult.size).toStrictEqual(3);
         expect(getNamesModules(testedResult)).toEqual(Object.keys(modules));
      });

      test('should return empty list if passed module not exists', () => {
         expect(modulesMap.getModules(['Mod']).size).toStrictEqual(0);
      });

      test('should return modules', () => {
         const testedResult = modulesMap.getModules(['UIModule', 'UnitModule']);

         expect(testedResult.size).toStrictEqual(2);
         expect(getNamesModules(testedResult)).toEqual(['UIModule', 'UnitModule']);
      });

      test('should return modules by filter', () => {
         const testedResult = modulesMap.getModules(['UIModule', 'UnitModule'], 'ui');

         expect(testedResult.size).toStrictEqual(1);
         expect(getNamesModules(testedResult)).toEqual(['UIModule']);
      });
   });

   describe('add()', () => {
      test('should ignore bl module', () => {
         modulesMap.add({
            type: 'bl',
            name: 'BLModule'
         });

         expect(modulesMap.all.size).toStrictEqual(3);

         for (const [name, module] of modulesMap.all) {
            expect(name).not.toStrictEqual('BLModule');
            expect(module.type).not.toStrictEqual('bl');
         }
      });

      test('should add new module', () => {
         modulesMap.add({
            type: 'ui',
            name: 'NewModule'
         });

         expect(modulesMap.all.size).toStrictEqual(4);

         expect(modulesMap.get('NewModule')).not.toBeUndefined();
      });

      test('should merge modules if map has adding module', () => {
         modulesMap.add({
            type: 'ui',
            name: 'UIModule',
            required: true
         });

         expect(modulesMap.all.size).toStrictEqual(3);

         expect(modulesMap.get('UIModule')).not.toBeUndefined();
         expect(modulesMap.get('UIModule').required).toBeTruthy();
      });
   });

   describe('addModules()', () => {
      test('should all modules', () => {
         modulesMap.addModules([
            {
               type: 'ui',
               name: 'NewUIModule'
            },
            {
               type: 'test',
               name: 'NewUnitModule'
            },
            {
               type: 'demo',
               name: 'NewDemoModule'
            }
         ]);

         expect(modulesMap.all.size).toStrictEqual(6);
         expect(modulesMap.ui.size).toStrictEqual(2);
         expect(modulesMap.test.size).toStrictEqual(2);
         expect(modulesMap.demo.size).toStrictEqual(2);

         expect(getNamesModules(modulesMap.all.values())).toEqual([
            ...Object.keys(modules),
            'NewUIModule',
            'NewUnitModule',
            'NewDemoModule'
         ]);
         expect(getNamesModules(modulesMap.test.values())).toEqual(['UnitModule', 'NewUnitModule']);
         expect(getNamesModules(modulesMap.demo.values())).toEqual(['DemoModule', 'NewDemoModule']);
         expect(getNamesModules(modulesMap.ui.values())).toEqual(['UIModule', 'NewUIModule']);
      });
   });

   describe('has()', () => {
      test('should return true if module exists', () => {
         expect(modulesMap.has('UIModule')).toBeTruthy();
         expect(modulesMap.has('UIModule', 'ui')).toBeTruthy();
      });

      test('should return true if module not exists', () => {
         expect(modulesMap.has('Module')).toBeFalsy();
         expect(modulesMap.has('UIModule', 'test')).toBeFalsy();
      });
   });

   describe('merge()', () => {
      test('should merge passed modules map with that map', () => {
         const newModulesMap = new ModulesMap({
            UIModule: {
               type: 'ui',
               name: 'NewUIModule'
            },
            DemoModule: {
               type: 'demo',
               name: 'NewDemoModule'
            },
            UnitModule: {
               type: 'test',
               name: 'NewUnitModule',
               repository: {
                  name: 'rep'
               }
            }
         });

         modulesMap.merge(newModulesMap);

         expect(modulesMap.test.size).toStrictEqual(2);
         expect(modulesMap.all.size).toStrictEqual(6);
         expect(modulesMap.demo.size).toStrictEqual(2);
         expect(modulesMap.ui.size).toStrictEqual(2);

         expect(getNamesModules(modulesMap.demo.values())).toEqual(['DemoModule', 'NewDemoModule']);
         expect(getNamesModules(modulesMap.ui.values())).toEqual(['UIModule', 'NewUIModule']);
         expect(getNamesModules(modulesMap.test.values())).toEqual(['UnitModule', 'NewUnitModule']);
         expect(getNamesModules(modulesMap.all.values())).toEqual([
            ...Object.keys(modules),
            'NewUIModule',
            'NewDemoModule',
            'NewUnitModule',
         ]);
      });
   });

   describe('delete()', () => {
      function expectModules(moduleName) {
         expect(modulesMap.all.has(moduleName)).toBeFalsy();
         expect(modulesMap.ui.has(moduleName)).toBeFalsy();
         expect(modulesMap.test.has(moduleName)).toBeFalsy();
         expect(modulesMap.demo.has(moduleName)).toBeFalsy();
      }

      test('should delete module', () => {
         modulesMap.delete('UIModule');
         expectModules('UIModule');

         modulesMap.delete('DemoModule');
         expectModules('DemoModule');

         modulesMap.delete('UnitModule');
         expectModules('UnitModule');
      });
   });

   describe('serialize()', () => {
      test('should return object', () => {
         const testedResult = modulesMap.serialize();

         expect(Object.keys(testedResult)).toEqual(Object.keys(modules));
      });
   });
});
