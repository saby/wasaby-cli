const fs = require('fs-extra');

const Builder = require('../../src/Entities/Builder');
const ModulesMap = require('../../src/Map/Modules');
const Module = require('../../src/Module/Module');
const Server = require('../../src/Server/Server');
const NodeJS = require('../../src/Process/NodeJS');

jest.mock('../../src/Utils/Logger', () => ({
   error: () => {},
   debug: () => {},
   info: () => {},
   writeFile: () => Promise.resolve(),
   dir: 'src/logs'
}));

jest.mock('../../src/Process/NodeJS', () => {
   return jest.fn().mockImplementation(() => {
      return {
         run: () => Promise.resolve()
      };
   });
});

const defaultBuilderConfig = {
   logs: 'src/logs/builderLogs',
   output: 'build/application',
   cache: 'build/cache',

   symlinks: true,
   useReact: true,
   tsc: true,
   mode: 'stand',
   typescript: true,
   contents: true,
   joinedMeta: true,
   less: true,
   resourcesUrl: false,
   modules: [],
   clearOutput: false,
   outputIsCache: true,

   minimize: undefined,
   wml: undefined,
   customPack: undefined,
   dependenciesGraph: undefined,
   htmlWml: undefined,

   localization: undefined,
   'default-localization': undefined,

   moduleType: 'amd'
};

function buildOptions(options = {}) {
   const result = new Map();

   result.set('resources', 'build/application');
   result.set('builderCache', 'build/cache');

   for (const [name, value] of Object.entries(options)) {
      result.set(name, value);
   }

   return result;
}

function expectBuilderConfig(config, expected) {
   const expectedConfig = { ...defaultBuilderConfig, ...expected };

   expect(config).toEqual(expectedConfig);
}

describe('Builder', () => {
   let detectAvailablePort;

   beforeEach(() => {
      detectAvailablePort = jest.spyOn(Server, 'detectAvailablePort').mockReturnValue(Promise.resolve(6666));
   });

   afterEach(() => {
      detectAvailablePort.mockRestore();
   });

   describe('constructor()', () => {
      test('should create builder with debug config', () => {
         const builder = new Builder(new ModulesMap(), buildOptions());

         expectBuilderConfig(builder.config);

         expect(builder.configPath).toStrictEqual('src/logs/builderConfig.json');
         expect(builder.metaInfoPath).toStrictEqual('build/application/metaInfo.json');
      });

      test('should create builder with release config', () => {
         const builder = new Builder(new ModulesMap(), buildOptions({
            release: true
         }));

         expectBuilderConfig(builder.config, {
            minimize: true,
            wml: true,
            customPack: true,
            dependenciesGraph: true,
            htmlWml: true
         });
      });

      test('should create builder with default cache path', () => {
         const builder = new Builder(new ModulesMap(), buildOptions({
            builderCache: undefined
         }));

         expectBuilderConfig(builder.config, {
            cache: 'build/build-ui/builder-json-cache'
         });
      });

      test('should create builder with default cache path', () => {
         const builder = new Builder(new ModulesMap(), buildOptions({
            builderCache: undefined
         }));

         expectBuilderConfig(builder.config, {
            cache: 'build/build-ui/builder-json-cache'
         });
      });

      test('should create builder with localization cache path', () => {
         const builder = new Builder(new ModulesMap(), buildOptions({
            localization: ['ru-RU', 'en-US']
         }));

         expectBuilderConfig(builder.config, {
            localization: ['ru-RU', 'en-US'],
            'default-localization': 'ru-RU'
         });
      });

      test('should create builder with disable symlink', () => {
         const builder = new Builder(new ModulesMap(), buildOptions({
            copy: true
         }));

         expectBuilderConfig(builder.config, {
            symlinks: false
         });
      });

      test('should create builder with tsconfig path', () => {
         const tsconfigPath = 'src/tsconfig.json';
         const builder = new Builder(new ModulesMap(), buildOptions({}), tsconfigPath);

         expectBuilderConfig(builder.config, {
            tsconfig: tsconfigPath
         });
      });
   });

   describe('_buildModulesListForConfig()', () => {
      let builder;
      let stubGetChangedFiles;
      let stubRemDir;
      const moduleInfo = {
         name: 'Module1',
         id: '1',
         type: 'ui',
         path: 'src/Module1',
         typescript: {
            typecheck: true
         }
      };
      const defaultModulesConfig = {
         id: '1',
         name: 'Module1',
         path: 'src/Module1',
         required: undefined,
         featuresProvided: undefined,
         featuresRequired: undefined,
         depends: [],
         service: ['intest-ps'],
         typescript: {
            typecheck: true
         }
      };

      function expectModulesConfig(config, expected = {}) {
         const expectedConfig = { ...defaultModulesConfig, ...expected };

         expect(config).toEqual(expectedConfig);
      }

      beforeEach(() => {
         builder = new Builder(new ModulesMap(), buildOptions());
         builder.metaInfo = new ModulesMap();

         stubRemDir = jest.spyOn(fs, 'remove').mockImplementation(() => Promise.resolve());
         stubGetChangedFiles = jest.spyOn(Module.prototype, 'getChangedFiles').mockImplementation((revision) => {
            if (revision === 'rev0') {
               return {
                  changed: ['src/Module1/changedFiles.js'],
                  deleted: []
               };
            }

            if (revision === 'rev1') {
               return {
                  changed: [],
                  deleted: ['src/Module1/deletedFiles.js']
               };
            }
         });
      });

      afterEach(() => {
         stubGetChangedFiles.mockRestore();
         stubRemDir.mockRestore();
      });

      test('should build modules list with ui module', async() => {
         builder.modules.add(Module.buildModuleFromObject(moduleInfo));

         await builder._buildModulesListForConfig();

         expect(builder.config.modules.length).toStrictEqual(1);
         expectModulesConfig(builder.config.modules[0]);
      });

      test('should build modules list with unit module', async() => {
         builder.modules.add(Module.buildModuleFromObject({
            ...moduleInfo,
            repository: {
               name: 'rep'
            },
            type: 'test'
         }));

         await builder._buildModulesListForConfig();

         expect(builder.config.modules.length).toStrictEqual(1);
         expectModulesConfig(builder.config.modules[0], {
            minimize: false,
            deprecatedXhtml: false,
            wml: false,
            ESVersion: 2021
         });
      });

      test('should build modules list with cdn module', async() => {
         builder.modules.add(Module.buildModuleFromObject({
            ...moduleInfo,
            forCDN: true
         }));

         await builder._buildModulesListForConfig();

         expect(builder.config.modules.length).toStrictEqual(1);
         expectModulesConfig(builder.config.modules[0], {
            minimize: false,
            ESVersion: 2021,
            parse: false
         });
      });

      test('should build modules list with module has file of changed', async() => {
         builder.modules.add(Module.buildModuleFromObject(moduleInfo));
         builder.metaInfo.add(Module.buildModuleFromObject({
            ...moduleInfo,
            revision: 'rev0'
         }));

         await builder._buildModulesListForConfig();

         expect(builder.config.modules.length).toStrictEqual(1);
         expectModulesConfig(builder.config.modules[0], {
            changedFiles: ['./changedFiles.js'],
            deletedFiles: []
         });
      });

      test('should build modules list with module has file of deleted', async() => {
         builder.modules.add(Module.buildModuleFromObject(moduleInfo));
         builder.metaInfo.add(Module.buildModuleFromObject({
            ...moduleInfo,
            revision: 'rev1'
         }));

         await builder._buildModulesListForConfig();

         expect(builder.config.modules.length).toStrictEqual(1);
         expectModulesConfig(builder.config.modules[0], {
            changedFiles: [],
            deletedFiles: ['./deletedFiles.js']
         });
      });

      test('should rebuild module if not detected changed files', async() => {
         stubGetChangedFiles.mockImplementation(() => {
            throw 'Error diff';
         });

         builder.modules.add(Module.buildModuleFromObject(moduleInfo));
         builder.metaInfo.add(Module.buildModuleFromObject({
            ...moduleInfo,
            revision: 'rev'
         }));

         await builder._buildModulesListForConfig();

         expect(builder.metaInfo.has('Module1')).toBeFalsy();
         expect(builder.config.modules.length).toStrictEqual(1);
         expectModulesConfig(builder.config.modules[0], {
            forceRebuild: true
         });
      });

      test('should build modules list with module has loadAfter construction', async() => {
         const loadAfterModule = {
            name: 'loadAfterModule',
            id: '2',
            path: 'src/loadAfterModule'
         };

         builder.modules.add(Module.buildModuleFromObject({
            ...loadAfterModule,
            type: 'ui',
            loadAfter: [
               'Module1'
            ],
            typescript: {
               typecheck: true
            }
         }));
         builder.modules.add(Module.buildModuleFromObject(moduleInfo));

         await builder._buildModulesListForConfig();

         expect(builder.config.modules.length).toStrictEqual(2);
         expectModulesConfig(builder.config.modules[0]);
         expectModulesConfig(builder.config.modules[1], loadAfterModule);
      });

      test('should return exception if modules with loadAfter construction have cyclic dependencies', async() => {
         const modulesName = ['loadAfterModule1', 'loadAfterModule2'];

         builder.modules.add(Module.buildModuleFromObject({
            name: 'loadAfterModule1',
            id: '1',
            path: 'src/loadAfterModule1',
            type: 'ui',
            loadAfter: [
               'loadAfterModule2'
            ]
         }));
         builder.modules.add(Module.buildModuleFromObject({
            name: 'loadAfterModule2',
            id: '2',
            path: 'src/loadAfterModule2',
            type: 'ui',
            loadAfter: [
               'loadAfterModule1'
            ]
         }));

         expect.assertions(1);

         try {
            await builder._buildModulesListForConfig();
         } catch (err) {
            expect(err.message).toStrictEqual(`Modules "${modulesName}" has cycle dependencies in "load_after" construction.`);
         }
      });

      test('should build modules list if one module with loadAfter construction is dependency another module', async() => {
         const loadAfterModule1 = {
            name: 'loadAfterModule1',
            id: '2',
            path: 'src/loadAfterModule1'
         };
         const loadAfterModule2 = {
            name: 'loadAfterModule2',
            id: '3',
            path: 'src/loadAfterModule2',
         };

         builder.modules.add(Module.buildModuleFromObject({
            ...loadAfterModule1,
            type: 'ui',
            loadAfter: [
               'loadAfterModule2'
            ],
            typescript: {
               typecheck: true
            }
         }));
         builder.modules.add(Module.buildModuleFromObject({
            ...loadAfterModule2,
            type: 'ui',
            loadAfter: [
               'Module1'
            ],
            typescript: {
               typecheck: true
            }
         }));
         builder.modules.add(Module.buildModuleFromObject(moduleInfo));

         await builder._buildModulesListForConfig();

         expect(builder.config.modules.length).toStrictEqual(3);
         expectModulesConfig(builder.config.modules[0]);
         expectModulesConfig(builder.config.modules[1], loadAfterModule2);
         expectModulesConfig(builder.config.modules[2], loadAfterModule1);
      });
   });

   describe('_saveBuildMeta()', () => {
      let stubUpdateRevision1;
      let stubUpdateRevision2;
      let stubPathExistsSync;
      let stubReadJsonSync;
      let stubOutputFile;
      let builder;

      beforeEach(() => {
         const module1 = Module.buildModuleFromObject({
            type: 'ui',
            name: 'Module1',
            id: '1',
            revision: 'rev1',
            repository: 'Repository'
         });
         const module2 = Module.buildModuleFromObject({
            type: 'ui',
            name: 'Module2',
            id: '2',
            revision: 'rev2',
            repository: 'Repository'
         });

         builder = new Builder(new ModulesMap(), buildOptions());
         builder.metaInfo = new ModulesMap({
            Module1: {
               type: 'ui',
               name: 'Module1',
               id: '1',
               revision: 'rev1',
               repository: 'Repository'
            },
            Module2: {
               type: 'ui',
               name: 'Module2',
               id: '2',
               revision: 'rev2',
               repository: 'Repository'
            },
            Module3: {
               type: 'ui',
               name: 'Module3',
               id: '3',
               revision: 'rev3',
               repository: 'Repository1'
            }
         });
         builder.modules.add(module1);
         builder.modules.add(module2);

         stubUpdateRevision1 = jest.spyOn(module1, 'updateRevision').mockImplementation(() => {
            module1.revision = 'newRevision1';
         });

         stubUpdateRevision2 = jest.spyOn(module2, 'updateRevision').mockImplementation(() => {
            module2.revision = 'newRevision2';
         });

         stubPathExistsSync = jest.spyOn(fs, 'pathExistsSync').mockImplementation(path => path !== 'src/NotExists/modules_stats.json');

         stubReadJsonSync = jest.spyOn(fs, 'readJsonSync').mockImplementation((path) => {
            if (path === 'src/logs/dropCache/modules_stats.json') {
               return {
                  modules: {
                     Module1: 'PASSED',
                     Module2: 'PASSED',
                  },
                  cacheIsDropped: true
               };
            }

            if (path === 'src/logs/success/modules_stats.json') {
               return {
                  modules: {
                     Module1: 'PASSED',
                     Module2: 'PASSED',
                  }
               };
            }

            if (path === 'src/logs/fail/modules_stats.json') {
               return {
                  modules: {
                     Module1: 'PASSED',
                     Module2: 'FAILED',
                  }
               };
            }
         });

         stubOutputFile = jest.spyOn(fs, 'outputFile').mockImplementation(() => Promise.resolve());
      });

      afterEach(() => {
         stubUpdateRevision1.mockRestore();
         stubUpdateRevision2.mockRestore();
         stubPathExistsSync.mockRestore();
         stubReadJsonSync.mockRestore();
         stubOutputFile.mockRestore();
      });

      test('should skip saving meta info if build result does not exists', async() => {
         builder.config.logs = 'src/NotExists';

         await builder._saveBuildMeta();

         expect(builder.metaInfo.all.size).toStrictEqual(3);
         expect(stubOutputFile.mock.calls.length).toStrictEqual(2);
         expect(builder.metaInfo.get('Module1').revision).toStrictEqual('rev1');
         expect(builder.metaInfo.get('Module2').revision).toStrictEqual('rev2');
         expect(builder.metaInfo.get('Module3').revision).toStrictEqual('rev3');
      });

      test('should skip saving meta info if cache was dropped', async() => {
         builder.config.logs = 'src/logs/dropCache';

         await builder._saveBuildMeta();

         expect(builder.metaInfo.all.size).toStrictEqual(2);
         expect(stubOutputFile.mock.calls.length).toStrictEqual(2);
         expect(builder.metaInfo.get('Module1').revision).toStrictEqual('newRevision1');
         expect(builder.metaInfo.get('Module2').revision).toStrictEqual('newRevision2');
      });

      test('should save meta info all modules if build was success', async() => {
         builder.config.logs = 'src/logs/success';

         await builder._saveBuildMeta();

         expect(builder.metaInfo.all.size).toStrictEqual(3);
         expect(stubOutputFile.mock.calls.length).toStrictEqual(2);
         expect(builder.metaInfo.get('Module1').revision).toStrictEqual('newRevision1');
         expect(builder.metaInfo.get('Module2').revision).toStrictEqual('newRevision2');
         expect(builder.metaInfo.get('Module3').revision).toStrictEqual('rev3');
      });

      test('should save meta info for only modules was success built', async() => {
         builder.config.logs = 'src/logs/fail';

         await builder._saveBuildMeta();

         expect(builder.metaInfo.all.size).toStrictEqual(3);
         expect(stubOutputFile.mock.calls.length).toStrictEqual(2);
         expect(builder.metaInfo.get('Module1').revision).toStrictEqual('newRevision1');
         expect(builder.metaInfo.get('Module2').revision).toStrictEqual('rev2');
         expect(builder.metaInfo.get('Module3').revision).toStrictEqual('rev3');
      });
   });

   describe('_readBuildMeta()', () => {
      let stubPathExistsSync;
      let stubReadJsonSync;
      let builder;

      beforeEach(() => {
         builder = new Builder(new ModulesMap(), buildOptions({
            onlyChanges: true,
            dependentModules: true
         }));
         builder.metaInfoPath = 'src/application/modules.json';

         stubPathExistsSync = jest.spyOn(fs, 'pathExistsSync').mockImplementation(path => path === 'src/application/modules.json');

         stubReadJsonSync = jest.spyOn(fs, 'readJson').mockImplementation((path) => {
            if (path === 'src/application/modules.json') {
               return {
                  Module1: {
                     type: 'ui',
                     name: 'Module1',
                     id: '1',
                     revision: 'rev1',
                     repository: 'Repository'
                  }
               };
            }
         });
      });

      afterEach(() => {
         stubPathExistsSync.mockRestore();
         stubReadJsonSync.mockRestore();
      });

      test('should create new meta info if file does not exists', async() => {
         builder.metaInfoPath = 'src/notExists';

         await builder._readMetaBuild();

         expect(builder.metaInfo).not.toBeUndefined();
         expect(builder.metaInfo.all.size).toStrictEqual(0);
      });

      test('should create new meta info if option "onlyChanges" is false', async() => {
         builder.options.set('onlyChanges', false);

         await builder._readMetaBuild();

         expect(builder.metaInfo).not.toBeUndefined();
         expect(builder.metaInfo.all.size).toStrictEqual(0);
      });

      test('should read meta info if it is exists', async() => {
         await builder._readMetaBuild();

         expect(builder.metaInfo).not.toBeUndefined();
         expect(builder.metaInfo.all.size).toStrictEqual(1);
         expect(builder.metaInfo.has('Module1')).toBeTruthy();
         expect(builder.metaInfo.get('Module1').name).toStrictEqual('Module1');
         expect(builder.metaInfo.get('Module1').id).toStrictEqual('1');
         expect(builder.metaInfo.get('Module1').revision).toStrictEqual('rev1');
      });
   });

   describe('_linkCDNModules()', () => {
      let stubPathExistsSync;
      let stubEnsureDirSync;
      let stubRmdir;
      let stubEnsureSymlink;
      let builder;

      beforeEach(() => {
         builder = new Builder(new ModulesMap({
            Module1: {
               type: 'ui',
               name: 'Module1',
               id: '1',
               forCDN: true
            },
            Module2: {
               type: 'ui',
               name: 'Module2',
               id: '2'
            }
         }), buildOptions());

         stubPathExistsSync = jest.spyOn(fs, 'pathExistsSync').mockImplementation(path => path === 'build/application/cdnExists/cdn');

         stubEnsureDirSync = jest.spyOn(fs, 'ensureDirSync').mockImplementation(() => true);

         stubRmdir = jest.spyOn(fs, 'remove').mockImplementation(() => Promise.resolve());

         stubEnsureSymlink = jest.spyOn(fs, 'ensureSymlink').mockImplementation(() => Promise.resolve());
      });

      afterEach(() => {
         stubPathExistsSync.mockRestore();
         stubEnsureDirSync.mockRestore();
         stubRmdir.mockRestore();
         stubEnsureSymlink.mockRestore();
      });

      test('should delete directory if it is exists', async() => {
         builder.config.output = 'build/application/cdnExists';

         await builder._linkCDNModules();

         expect(stubRmdir.mock.calls.length).toStrictEqual(1);
         expect(stubRmdir.mock.calls[0][0]).toStrictEqual('build/application/cdnExists/cdn');
      });

      test('should create directory if it is not exists', async() => {
         await builder._linkCDNModules();

         expect(stubEnsureDirSync.mock.calls.length).toStrictEqual(1);
         expect(stubEnsureDirSync.mock.calls[0][0]).toStrictEqual('build/application/cdn');
      });

      test('should create symlinks to cdn modules', async() => {
         await builder._linkCDNModules();

         expect(stubEnsureSymlink.mock.calls.length).toStrictEqual(1);
         expect(stubEnsureSymlink.mock.calls[0][0]).toStrictEqual('build/application/Module1');
         expect(stubEnsureSymlink.mock.calls[0][1]).toStrictEqual('build/application/cdn/Module1');
      });
   });

   describe('_tslibInstall()', () => {
      let builder;

      beforeEach(() => {
         builder = new Builder(new ModulesMap({
            'WS.Core': {
               type: 'ui',
               name: 'WS.Core',
               id: '1',
               path: 'src/WS.Core'
            }
         }), buildOptions());
      });

      test('should not create symlink to tslib.js if module WS.Core is not exists', async() => {
         builder.modules = new ModulesMap();

         await builder._tslibInstall();

         expect(NodeJS.mock.calls.length).toStrictEqual(0);
      });

      test('should create symlinks to tslib.js', async() => {
         await builder._tslibInstall();

         expect(NodeJS.mock.calls.length).toStrictEqual(1);
      });
   });

   describe('startWatcher()', () => {
      let builder;

      beforeEach(() => {
         builder = new Builder(new ModulesMap(), buildOptions());
         NodeJS.mockClear();
      });

      test('should create subprocess', async() => {
         await builder.startWatcher();

         expect(NodeJS.mock.calls.length).toStrictEqual(1);
         expect(NodeJS.mock.calls[0][0]).toEqual({
            type: 'fork',
            exeFile: require.resolve('gulp/bin/gulp.js'),
            command: 'buildOnChangeWatcher',
            options: {
               config: 'src/logs/builderConfig.json',
               gulpfile: require.resolve('sbis3-builder/gulpfile.js')
            },
            processName: 'builderWatcher',
            onData: Builder.checkError,
            onMassage: undefined
         });
      });

      test('should create subprocess and subscribe to message event', async() => {
         const callback = () => {};
         await builder.startWatcher(callback);

         expect(NodeJS.mock.calls.length).toStrictEqual(1);
         expect(NodeJS.mock.calls[0][0]).toEqual({
            type: 'fork',
            exeFile: require.resolve('gulp/bin/gulp.js'),
            command: 'buildOnChangeWatcher',
            options: {
               config: 'src/logs/builderConfig.json',
               gulpfile: require.resolve('sbis3-builder/gulpfile.js')
            },
            processName: 'builderWatcher',
            onData: Builder.checkError,
            onMassage: callback
         });
      });
   });

   describe('prepareHotReload()', () => {
      test('should create options for hotReload', async() => {
         const builder = new Builder(new ModulesMap({
            HotReload: {
               type: 'ui',
               name: 'HotReload',
               id: '1'
            }
         }), buildOptions({
            hotReload: true
         }));

         await builder._prepareHotReload();

         expect(builder.hotReloadPort).toStrictEqual(6666);
         expectBuilderConfig(builder.config, {
            staticServer: 'localhost:6666'
         });
      });

      test('should skip prepare for hotReload if hotReload options is disable', async() => {
         const builder = new Builder(new ModulesMap({
            HotReload: {
               type: 'ui',
               name: 'HotReload',
               id: '1'
            }
         }), buildOptions({
            hotReload: false
         }));

         await builder._prepareHotReload();

         expect(builder.hotReloadPort).toBeUndefined();
         expectBuilderConfig(builder.config);
      });
   });

   describe('startHotReload()', () => {
      let builder;

      beforeEach(() => {
         builder = new Builder(new ModulesMap({
            HotReload: {
               type: 'ui',
               name: 'HotReload',
               path: 'build/application/HotReload',
               id: '1'
            }
         }), buildOptions());

         NodeJS.mockClear();
         builder.hotReloadPort = 6666;
      });

      test('should start hotReload server', async() => {
         await builder.startHotReload();

         expect(NodeJS.mock.calls.length).toStrictEqual(1);
         expect(NodeJS.mock.calls[0][0]).toEqual({
            exeFile: 'build/application/HotReload/eventStream/third-party/server',
            options: {
               port: 6666
            },
            procOptions: {
               cwd: process.cwd()
            },
            processName: 'hotReload'
         });
      });
   });

   describe('startBuild()', () => {
      let builder;

      beforeEach(() => {
         builder = new Builder(new ModulesMap(), buildOptions());
         NodeJS.mockClear();
      });

      test('should start build', async() => {
         await builder.startBuild();

         expect(NodeJS.mock.calls.length).toStrictEqual(1);
         expect(NodeJS.mock.calls[0][0]).toEqual({
            exeFile: require.resolve('gulp/bin/gulp.js'),
            command: 'build',
            options: {
               config: 'src/logs/builderConfig.json',
               gulpfile: require.resolve('sbis3-builder/gulpfile.js'),
               'log-level': undefined
            },
            procOptions: {
               cwd: process.cwd()
            },
            processName: 'builder',
            onData: Builder.checkError
         });
      });
   });

   describe('watcher()', () => {
      let builder;
      let stubStartHotReload;
      let stubStartWatcher;

      beforeEach(() => {
         builder = new Builder(new ModulesMap(), buildOptions());

         stubStartHotReload = jest.spyOn(builder, 'startHotReload').mockImplementation(() => Promise.resolve());
         stubStartWatcher = jest.spyOn(builder, 'startWatcher').mockImplementation(() => Promise.resolve());
      });

      afterEach(() => {
         stubStartHotReload.mockRestore();
         stubStartWatcher.mockRestore();
      });

      test('should start watcher and server for hotReload', async() => {
         const callback = () => {};

         builder.options = buildOptions({
            hotReload: true
         });

         await builder.watcher(callback);

         expect(stubStartHotReload.mock.calls.length).toStrictEqual(1);
         expect(stubStartHotReload.mock.calls[0].length).toStrictEqual(0);

         expect(stubStartWatcher.mock.calls.length).toStrictEqual(1);
         expect(stubStartWatcher.mock.calls[0][0]).toStrictEqual(callback);
      });

      test('should start only watcher', async() => {
         const callback = () => {};

         await builder.watcher(callback);

         expect(stubStartHotReload.mock.calls.length).toStrictEqual(0);

         expect(stubStartWatcher.mock.calls.length).toStrictEqual(1);
         expect(stubStartWatcher.mock.calls[0][0]).toStrictEqual(callback);
      });
   });

   describe('saveConfig()', () => {
      let builder;
      let stubOutputFile;

      beforeEach(() => {
         builder = new Builder(new ModulesMap(), buildOptions());

         stubOutputFile = jest.spyOn(fs, 'outputFile').mockImplementation(() => Promise.resolve());
      });

      afterEach(() => {
         stubOutputFile.mockRestore();
      });

      test('should save builder config to file', async() => {
         const testedConfig = (new Builder(new ModulesMap(), buildOptions())).config;
         await builder.saveConfig();

         expect(stubOutputFile.mock.calls.length).toStrictEqual(1);
         expect(stubOutputFile.mock.calls[0][0]).toStrictEqual('src/logs/builderConfig.json');
         expect(stubOutputFile.mock.calls[0][1]).toStrictEqual(JSON.stringify(testedConfig, null, 4));
      });
   });

   describe('build()', () => {
      let builder;
      let stubReadMetaBuild;
      let stubBuildModulesList;
      let stubSaveConfig;
      let stubTslibInstall;
      let stubPrepareHotReload;
      let stubStartBuild;
      let stubLinkCDNModules;
      let stubSaveBuildMeta;

      beforeEach(() => {
         builder = new Builder(new ModulesMap(), buildOptions());

         stubReadMetaBuild = jest.spyOn(builder, '_readMetaBuild').mockReturnValue(Promise.resolve());
         stubBuildModulesList = jest.spyOn(builder, '_buildModulesListForConfig').mockImplementation(() => Promise.resolve());
         stubSaveConfig = jest.spyOn(builder, 'saveConfig').mockImplementation(() => Promise.resolve());
         stubTslibInstall = jest.spyOn(builder, '_tslibInstall').mockImplementation(() => Promise.resolve());
         stubPrepareHotReload = jest.spyOn(builder, '_prepareHotReload').mockImplementation(() => Promise.resolve());
         stubStartBuild = jest.spyOn(builder, 'startBuild').mockImplementation(() => Promise.resolve());
         stubLinkCDNModules = jest.spyOn(builder, '_linkCDNModules').mockImplementation(() => Promise.resolve());
         stubSaveBuildMeta = jest.spyOn(builder, '_saveBuildMeta').mockImplementation(() => Promise.resolve());
      });

      afterEach(() => {
         stubReadMetaBuild.mockRestore();
         stubBuildModulesList.mockRestore();
         stubSaveConfig.mockRestore();
         stubTslibInstall.mockRestore();
         stubPrepareHotReload.mockRestore();
         stubStartBuild.mockRestore();
         stubLinkCDNModules.mockRestore();
         stubSaveBuildMeta.mockRestore();
      });

      test('should before prepare builder config and hotReload and start build and after save metainfo', async() => {
         await builder.build();

         expect(stubReadMetaBuild.mock.calls.length).toStrictEqual(1);
         expect(stubBuildModulesList.mock.calls.length).toStrictEqual(1);
         expect(stubSaveConfig.mock.calls.length).toStrictEqual(1);
         expect(stubTslibInstall.mock.calls.length).toStrictEqual(1);
         expect(stubPrepareHotReload.mock.calls.length).toStrictEqual(1);
         expect(stubStartBuild.mock.calls.length).toStrictEqual(1);
         expect(stubLinkCDNModules.mock.calls.length).toStrictEqual(1);
         expect(stubSaveBuildMeta.mock.calls.length).toStrictEqual(1);
      });

      test('should save metainfo and create symlinks to cdn if build fail', async() => {
         stubStartBuild.mockImplementation(() => Promise.reject('Build fail'));

         await expect(builder.build()).rejects.toMatch('Build fail');

         expect(stubSaveConfig.mock.calls.length).toStrictEqual(1);
         expect(stubTslibInstall.mock.calls.length).toStrictEqual(1);
         expect(stubReadMetaBuild.mock.calls.length).toStrictEqual(1);
         expect(stubBuildModulesList.mock.calls.length).toStrictEqual(1);
         expect(stubPrepareHotReload.mock.calls.length).toStrictEqual(1);
         expect(stubStartBuild.mock.calls.length).toStrictEqual(1);
         expect(stubLinkCDNModules.mock.calls.length).toStrictEqual(1);
         expect(stubSaveBuildMeta.mock.calls.length).toStrictEqual(1);
      });
   });
});
