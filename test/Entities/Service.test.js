const Service = require('../../src/Entities/Service');
const xml = require('../../src/Utils/xml');
const fs = require('fs-extra');

function buildAstService(items = [], parents = []) {
   const astItems = [];
   const astParents = [];

   for (const item of items) {
      astItems.push({
         $: item
      });
   }

   for (const parent of parents) {
      astParents.push({
         $: parent
      });
   }

   return {
      service: {
         $: {},
         items: [
            {
               ui_module: astItems
            }
         ],
         parent: astParents
      }
   };
}

describe('Service', () => {
   let stubReadXmlFile;
   let stubWriteXmlFile;
   let stubPathExistsSync;

   beforeEach(() => {
      stubReadXmlFile = jest.spyOn(xml, 'readXmlFile').mockImplementation((path) => {
         if (path === 'src/EmptyItemsService') {
            return Promise.resolve({
               service: {
                  $: {},
                  items: []
               }
            });
         }

         if (path === 'src/Service') {
            return Promise.resolve(buildAstService([
               {
                  name: 'Module1',
                  id: '1',
                  url: '../src/Module1'
               }
            ]));
         }

         if (path === 'src/ServiceWithParent') {
            return Promise.resolve(buildAstService([], [
               {
                  path: './ParentService'
               }
            ]));
         }

         if (path === 'src/ParentService') {
            return Promise.resolve(buildAstService([
               {
                  name: 'Module2',
                  id: '2',
                  url: '../src/Module2'
               }
            ]));
         }
      });

      stubWriteXmlFile = jest.spyOn(xml, 'writeXmlFile').mockReturnValue(Promise.resolve());

      stubPathExistsSync = jest.spyOn(fs, 'pathExistsSync').mockImplementation(path => path === 'src/ParentService');
   });

   afterEach(() => {
      stubReadXmlFile.mockRestore();
      stubPathExistsSync.mockRestore();
      stubWriteXmlFile.mockRestore();
   });

   describe('buildAst()', () => {
      test('should create service with empty items list', async() => {
         const service = new Service('src/EmptyItemsService');

         await service.ready;

         expect(service.modules.size).toStrictEqual(0);
      });

      test('should create service with one item', async() => {
         const service = new Service('src/Service');

         await service.ready;

         expect(service.modules.size).toStrictEqual(1);
         expect(service.modules.has('Module1')).toBeTruthy();
         expect(service.modules.get('Module1').id).toStrictEqual('1');
      });

      test('should create service with one parent', async() => {
         const service = new Service('src/ServiceWithParent');

         await service.ready;

         expect(service.parents.size).toStrictEqual(1);
      });
   });

   describe('getModules()', () => {
      test('should return all modules', async() => {
         const service = new Service('src/Service');
         const modules = await service.getModules();

         expect(modules.size).toStrictEqual(1);
         expect(modules.has('Module1')).toBeTruthy();
         expect(modules.get('Module1').id).toStrictEqual('1');
      });
   });

   describe('deleteModules()', () => {
      test('should delete all modules', async() => {
         const service = new Service('src/Service');

         await service.ready;

         expect(service.modules.size).toStrictEqual(1);
         expect(service.ast.service.items[0].ui_module.length).toStrictEqual(1);

         await service.deleteModules();

         expect(service.modules.size).toStrictEqual(0);
         expect(service.ast.service.items[0].ui_module.length).toStrictEqual(0);
      });
   });

   describe('getAllService()', () => {
      test('should return all parent chain', async() => {
         const service = new Service('src/ServiceWithParent');
         const parents = await service.getAllService();

         expect(parents.size).toStrictEqual(2);
      });
   });

   describe('addModules()', () => {
      test('should add all modules', async() => {
         const service = new Service('src/Service');

         await service.addModules(new Set([
            {
               id: '3',
               name: 'NewModule1',
               s3mod: 'src/NewModule1'
            },
            {
               id: '4',
               name: 'NewModule2',
               s3mod: 'src/NewModule2'
            }
         ]));

         expect(service.modules.size).toStrictEqual(3);

         expect(service.modules.has('Module1')).toBeTruthy();
         expect(service.modules.get('Module1').id).toStrictEqual('1');
         expect(service.modules.get('Module1').url).toStrictEqual('src/Module1');

         expect(service.modules.has('NewModule1')).toBeTruthy();
         expect(service.modules.get('NewModule1').id).toStrictEqual('3');
         expect(service.modules.get('NewModule1').url).toStrictEqual('src/NewModule1');

         expect(service.modules.has('NewModule2')).toBeTruthy();
         expect(service.modules.get('NewModule2').id).toStrictEqual('4');
         expect(service.modules.get('NewModule2').url).toStrictEqual('src/NewModule2');
      });
   });

   describe('save()', () => {
      test('should write service config file', async() => {
         const service = new Service('src/Service');

         await service.save();

         expect(stubWriteXmlFile.mock.calls.length).toStrictEqual(1);

         expect(stubWriteXmlFile.mock.calls[0][0]).toStrictEqual('src/Service');
         expect(stubWriteXmlFile.mock.calls[0][1]).toStrictEqual({
            service: {
               $: {},
               items: [
                  {
                     ui_module: [
                        {
                           $: {
                              name: 'Module1',
                              id: '1',
                              url: 'src/Module1'
                           }
                        }
                     ]
                  }
               ],
               parent: []
            }
         });
      });
   });
});
