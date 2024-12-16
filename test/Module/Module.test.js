const Repository = require('../../src/Entities/Repository');
const Module = require('../../src/Module/Module');
const xml = require('../../src/Utils/xml');
const fs = require('fs-extra');

const REPOS_DIR = '/tmp/repos/';
const REPOS_NAME = 'test-repos';
const REPOS_URL = 'https://git.sbis.ru/test/test-repos.git';

jest.mock('../../src/Utils/Logger', () => ({
   error: () => {},
   debug: () => {},
   info: () => {},
   writeFile: () => Promise.resolve(),
   dir: 'src/logs'
}));

function buildAstModule(attributes = {}, block = {}) {
   return {
      ui_module: {
         $: {
            id: '1',
            name: 'Module',
            for_cdn: '0',
            required: '0',
            is_react: '0',
            ...attributes
         },
         depends: [],
         ...block
      }
   };
}

describe('Module', () => {
   let repository;
   let module;

   const changedFilesOfModule = {
      changed: [
         'src/server/UIModule/List.tsx',
         'src/server/UIModule/List.less',
         'src/server/UIModule/Form.less'
      ],
      deleted: [
         'src/server/UIModule/OldList.tsx'
      ]
   };

   const changedFilesOfRepository = {
      changed: [
         'src/FirstBuildModule/Banner.ts',
         'src/FirstBuildModule/Banner.less',
         'src/FirstBuildModule/Logo.png',
         'src/client/UIModule/Button.tsx',
         'src/client/UIModule/Title.tsx',
         'package.json',
         'README.MD',
         ...changedFilesOfModule.changed
      ],
      deleted: [
         'src/server/FirstBuildModule/OldList.tsx',
         ...changedFilesOfModule.deleted
      ]
   };

   beforeEach(() => {
      jest.spyOn(fs, 'ensureDirSync').mockImplementation(() => true);
      repository = new Repository({
         dir: REPOS_DIR,
         name: REPOS_NAME,
         url: REPOS_URL,
         HEAD: 'rev1'
      });
      module = new Module({
         name: 'UIModule',
         s3mod: 'src/server/UIModule/UIModule.s3mod',
         path: 'src/server/UIModule',
         id: '1',
         rep: REPOS_NAME,
         revision: 'rev0',
         repository
      });
   });

   describe('getChangedFiles()', () => {
      let stubRepGetChangedFiles;

      beforeEach(() => {
         stubRepGetChangedFiles = jest.spyOn(repository, 'getChangedFiles').mockImplementation((revision) => {
            if (revision === 'rev0') {
               return Promise.resolve(changedFilesOfRepository);
            }

            return Promise.resolve([]);
         });
      });

      afterEach(() => {
         stubRepGetChangedFiles.mockRestore();
      });

      test('should return exception', async() => {
         module.repository = undefined;
         expect.assertions(1);

         try {
            await module.getChangedFiles('rev0');
         } catch (err) {
            expect(err.message).toStrictEqual(`Module ${module.name} not has Repository instance`);
         }
      });

      test('should list changed files only modules', () => module.getChangedFiles('rev0').then((list) => {
         expect(list.changed).toEqual(changedFilesOfModule.changed);
         expect(list.delete).toEqual(changedFilesOfModule.delete);
      }));
   });

   describe('updateRevision()', () => {
      test('should update revision', () => {
         module.updateRevision();
         expect(module.revision).toStrictEqual('rev1');
      });
   });

   describe('merge()', () => {
      test('should merge modules', () => {
         module.merge({
            type: 'newType',
            id: '9999',
            name: 'newName',
            s3mod: 'newS3mod',
            path: 'newPath',
            repository: 'newrRepository',
            revision: 'newRevision',
            depends: ['newDeps'],
            isReact: true,
            required: true,
            forCDN: true,
            featuresProvided: ['newFeature'],
            featuresRequired: ['newFeature']
         });

         expect(module.type).toStrictEqual('newType');
         expect(module.s3mod).toStrictEqual('newS3mod');
         expect(module.path).toStrictEqual('newPath');
         expect(module.id).toStrictEqual('9999');
         expect(module.name).toStrictEqual('newName');
         expect(module.revision).toStrictEqual('newRevision');
         expect(module.depends).toEqual(['newDeps']);
         expect(module.forCDN).toBeTruthy();
         expect(module.required).toBeTruthy();
         expect(module.featuresProvided).toEqual(['newFeature']);
         expect(module.featuresRequired).toEqual(['newFeature']);
      });
   });

   describe('serialize()', () => {
      test('should return native object', () => {
         const testedResult = module.serialize();

         expect(testedResult.type).toStrictEqual('module');
         expect(testedResult.s3mod).toStrictEqual('src/server/UIModule/UIModule.s3mod');
         expect(testedResult.path).toStrictEqual('src/server/UIModule');
         expect(testedResult.id).toStrictEqual('1');
         expect(testedResult.name).toStrictEqual('UIModule');
         expect(testedResult.repository).toStrictEqual(REPOS_NAME);
         expect(testedResult.revision).toStrictEqual('rev0');
         expect(testedResult.depends).toEqual([]);
         expect(testedResult.forCDN).toBeFalsy();
         expect(testedResult.required).toBeFalsy();
         expect(testedResult.isReact).toBeFalsy();
         expect(testedResult.featuresProvided).toBeUndefined();
         expect(testedResult.featuresRequired).toBeUndefined();
      });
   });

   describe('buildModuleFromXml()', () => {
      let stubReadXmlFile;

      beforeEach(() => {
         stubReadXmlFile = jest.spyOn(xml, 'readXmlFile').mockImplementation((path) => {
            if (path === 'src/Module') {
               return Promise.resolve(buildAstModule());
            }

            if (path === 'src/ReactModule') {
               return Promise.resolve(buildAstModule({
                  is_react: '1',
                  name: 'ReactModule'
               }));
            }

            if (path === 'src/RequiredModule') {
               return Promise.resolve(buildAstModule({
                  required: '1',
                  name: 'RequiredModule'
               }));
            }

            if (path === 'src/ModuleDeps') {
               return Promise.resolve(buildAstModule({
                  name: 'ModuleDeps'
               }, {
                  depends: [{
                     ui_module: [{
                        $: {
                           id: '11',
                           name: 'ModuleDep1'
                        }
                     }],
                     module: [{
                        $: {
                           id: '12',
                           name: 'ModuleDep2'
                        }
                     }]
                  }]
               }));
            }

            if (path === 'src/ModuleFeaturesProvider') {
               return Promise.resolve(buildAstModule({
                  name: 'ModuleFeaturesProvider'
               }, {
                  features_provided: [
                     {
                        feature: [
                           {
                              $: {
                                 name: 'Feature1'
                              }
                           }
                        ]
                     }
                  ]
               }));
            }

            if (path === 'src/ModuleFeaturesRequired') {
               return Promise.resolve(buildAstModule({
                  name: 'ModuleFeaturesRequired'
               }, {
                  features_required: [
                     {
                        feature: [
                           {
                              $: {
                                 name: 'Feature1'
                              }
                           }
                        ]
                     }
                  ]
               }));
            }

            if (path === 'src/ModuleLoadAfter') {
               return Promise.resolve(buildAstModule({
                  name: 'ModuleLoadAfter'
               }, {
                  load_after: [
                     {
                        module: [
                           {
                              $: {
                                 name: 'Module1'
                              }
                           }
                        ]
                     }
                  ]
               }));
            }

            if (path === 'src/Module-demo') {
               return Promise.resolve(buildAstModule({
                  id: '3',
                  name: 'Module-demo'
               }));
            }

            if (path === 'src/CDNModule') {
               return Promise.resolve(buildAstModule({
                  id: '4',
                  for_cdn: '1',
                  name: 'CDNModule'
               }));
            }

            if (path === 'src/ModuleUnit') {
               return Promise.resolve(buildAstModule({
                  id: '2',
                  name: 'ModuleUnit'
               }, {
                  test: [{}]
               }));
            }

            if (path === 'src/BLModule') {
               return {
                  bl_module: {
                     $: {
                        id: '6',
                        name: 'BLModule'
                     },
                     depends: []
                  }
               };
            }
         });
      });

      afterEach(() => {
         stubReadXmlFile.mockRestore();
      });

      test('should create ui module', async() => {
         const testModule = await Module.buildModuleFromXml('src/Module');

         expect(testModule.type).toStrictEqual('ui');
         expect(testModule.s3mod).toStrictEqual('src/Module');
         expect(testModule.path).toStrictEqual('src');
         expect(testModule.id).toStrictEqual('1');
         expect(testModule.name).toStrictEqual('Module');
         expect(testModule.depends).toEqual([]);
         expect(testModule.forCDN).toBeFalsy();
         expect(testModule.required).toBeFalsy();
         expect(testModule.isReact).toBeFalsy();
      });

      test('should create CDN module', async() => {
         const testModule = await Module.buildModuleFromXml('src/CDNModule');

         expect(testModule.type).toStrictEqual('ui');
         expect(testModule.s3mod).toStrictEqual('src/CDNModule');
         expect(testModule.path).toStrictEqual('src');
         expect(testModule.id).toStrictEqual('4');
         expect(testModule.name).toStrictEqual('CDNModule');
         expect(testModule.depends).toEqual([]);
         expect(testModule.forCDN).toBeTruthy();
         expect(testModule.required).toBeFalsy();
         expect(testModule.isReact).toBeFalsy();
      });

      test('should create required module', async() => {
         const testModule = await Module.buildModuleFromXml('src/RequiredModule');

         expect(testModule.type).toStrictEqual('ui');
         expect(testModule.s3mod).toStrictEqual('src/RequiredModule');
         expect(testModule.path).toStrictEqual('src');
         expect(testModule.id).toStrictEqual('1');
         expect(testModule.name).toStrictEqual('RequiredModule');
         expect(testModule.depends).toEqual([]);
         expect(testModule.forCDN).toBeFalsy();
         expect(testModule.required).toBeTruthy();
         expect(testModule.isReact).toBeFalsy();
      });

      test('should create ui module with depends', async() => {
         const testModule = await Module.buildModuleFromXml('src/ModuleDeps');

         expect(testModule.type).toStrictEqual('ui');
         expect(testModule.s3mod).toStrictEqual('src/ModuleDeps');
         expect(testModule.path).toStrictEqual('src');
         expect(testModule.id).toStrictEqual('1');
         expect(testModule.name).toStrictEqual('ModuleDeps');
         expect(testModule.depends).toEqual(['ModuleDep1', 'ModuleDep2']);
         expect(testModule.forCDN).toBeFalsy();
         expect(testModule.required).toBeFalsy();
         expect(testModule.isReact).toBeFalsy();
      });

      test('should create ui module with feature provider', async() => {
         const testModule = await Module.buildModuleFromXml('src/ModuleFeaturesProvider');

         expect(testModule.type).toStrictEqual('ui');
         expect(testModule.s3mod).toStrictEqual('src/ModuleFeaturesProvider');
         expect(testModule.path).toStrictEqual('src');
         expect(testModule.id).toStrictEqual('1');
         expect(testModule.name).toStrictEqual('ModuleFeaturesProvider');
         expect(testModule.depends).toEqual([]);
         expect(testModule.forCDN).toBeFalsy();
         expect(testModule.required).toBeFalsy();
         expect(testModule.isReact).toBeFalsy();

         expect(testModule.featuresProvided).toEqual(['Feature1']);
      });

      test('should create ui module with feature required', async() => {
         const testModule = await Module.buildModuleFromXml('src/ModuleFeaturesRequired');

         expect(testModule.type).toStrictEqual('ui');
         expect(testModule.s3mod).toStrictEqual('src/ModuleFeaturesRequired');
         expect(testModule.path).toStrictEqual('src');
         expect(testModule.id).toStrictEqual('1');
         expect(testModule.name).toStrictEqual('ModuleFeaturesRequired');
         expect(testModule.depends).toEqual([]);
         expect(testModule.forCDN).toBeFalsy();
         expect(testModule.required).toBeFalsy();
         expect(testModule.isReact).toBeFalsy();

         expect(testModule.featuresRequired).toEqual(['Feature1']);
      });

      test('should create ui module with after load', async() => {
         const testModule = await Module.buildModuleFromXml('src/ModuleLoadAfter');

         expect(testModule.type).toStrictEqual('ui');
         expect(testModule.s3mod).toStrictEqual('src/ModuleLoadAfter');
         expect(testModule.path).toStrictEqual('src');
         expect(testModule.id).toStrictEqual('1');
         expect(testModule.name).toStrictEqual('ModuleLoadAfter');
         expect(testModule.depends).toEqual([]);
         expect(testModule.forCDN).toBeFalsy();
         expect(testModule.required).toBeFalsy();
         expect(testModule.isReact).toBeFalsy();

         expect(testModule.loadAfter).toEqual(['Module1']);
      });

      test('should create demo module', async() => {
         const testModule = await Module.buildModuleFromXml('src/Module-demo');

         expect(testModule.type).toStrictEqual('demo');
         expect(testModule.s3mod).toStrictEqual('src/Module-demo');
         expect(testModule.path).toStrictEqual('src');
         expect(testModule.id).toStrictEqual('3');
         expect(testModule.name).toStrictEqual('Module-demo');
         expect(testModule.depends).toEqual([]);
         expect(testModule.forCDN).toBeFalsy();
         expect(testModule.required).toBeFalsy();
         expect(testModule.isReact).toBeFalsy();
      });

      test('should create unit module', async() => {
         const testModule = await Module.buildModuleFromXml('src/ModuleUnit', {
            repository: {
               name: 'rep'
            }
         });

         expect(testModule.type).toStrictEqual('test');
         expect(testModule.s3mod).toStrictEqual('src/ModuleUnit');
         expect(testModule.path).toStrictEqual('src');
         expect(testModule.id).toStrictEqual('2');
         expect(testModule.name).toStrictEqual('ModuleUnit');
         expect(testModule.depends).toEqual([]);
         expect(testModule.forCDN).toBeFalsy();
         expect(testModule.required).toBeFalsy();
         expect(testModule.isReact).toBeFalsy();

         expect(testModule.environment).toEqual('NodeJS');
      });

      test('should create bl module', async() => {
         const testModule = await Module.buildModuleFromXml('src/BLModule');

         expect(testModule.type).toStrictEqual('bl');
         expect(testModule.s3mod).toStrictEqual('src/BLModule');
         expect(testModule.path).toStrictEqual('src');
         expect(testModule.id).toStrictEqual('6');
         expect(testModule.name).toStrictEqual('BLModule');
         expect(testModule.depends).toEqual([]);
         expect(testModule.forCDN).toBeFalsy();
         expect(testModule.required).toBeFalsy();
         expect(testModule.isReact).toBeFalsy();
      });

      test('should create ui module with user options', async() => {
         const testModule = await Module.buildModuleFromXml('src/Module', {
            repository: 'userRepository',
            required: true
         });

         expect(testModule.type).toStrictEqual('ui');
         expect(testModule.s3mod).toStrictEqual('src/Module');
         expect(testModule.repository).toStrictEqual('userRepository');
         expect(testModule.path).toStrictEqual('src');
         expect(testModule.id).toStrictEqual('1');
         expect(testModule.name).toStrictEqual('Module');
         expect(testModule.depends).toEqual([]);
         expect(testModule.forCDN).toBeFalsy();
         expect(testModule.required).toBeTruthy();
         expect(testModule.isReact).toBeFalsy();
      });
   });
});
