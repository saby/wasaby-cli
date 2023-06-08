const Jinnee = require('../../src/Entities/Jinnee');

const xml = require('../../src/Utils/xml');
const ModulesMap = require('../../src/Map/Modules');
const Builder = require('../../src/Entities/Builder');

const fs = require('fs-extra');

jest.mock('../../src/Utils/Logger', () => ({
   error: () => {},
   debug: () => {},
   info: () => {},
   writeFile: () => Promise.resolve(),
   dir: 'src/logs'
}));

const tsconfigPath = 'src/myTSConfig.json';
const defaultJinneeConfig = {
   cld_name: 'InTest',
   cld_responsible: 'Ларионова А.В.',
   branchTests: true,
   lessCoverage: true,
   presentationServiceMeta: true,

   logs: 'src/logs/builderLogs',
   tsconfig: tsconfigPath,
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
   resourcesUrl: true,
   modules: [],
   clearOutput: false,
   outputIsCache: true,

   minimize: true,
   wml: true,
   customPack: true,
   dependenciesGraph: true,
   htmlWml: true,

   deprecatedStaticHtml: false,
   deprecatedXhtml: true,
   deprecatedWebPageTemplates: true,
   deprecatedOwnDependencies: true,

   localization: [
      'en-US',
      'ru-RU'
   ],
   'default-localization': 'ru-RU',

   'multi-service': false,
   'url-service-path': '/',
   'ui-service-path': '/',
   'url-default-service-path': '',
   moduleType: 'amd'
};

function buildOptions(options = {}) {
   const result = new Map();

   result.set('resources', 'build/application');
   result.set('builderCache', 'build/cache');
   result.set('projectDir', 'src/stands/Jinnee');
   result.set('pathToJinnee', 'src/SDK/jinnee');
   result.set('workDir', 'build/application/workDir');
   result.set('artifactsDir', 'build/artifacts');
   result.set('pathToSDK', 'src/SDK');

   for (const [name, value] of Object.entries(options)) {
      result.set(name, value);
   }

   return result;
}

function expectJinneeConfig(config, expected = {}) {
   const expectedConfig = { ...defaultJinneeConfig, ...expected };

   expect(config).toEqual(expectedConfig);
}

describe('Jinnee', () => {
   let stubPathExistsSync;

   beforeEach(() => {
      stubPathExistsSync = jest.spyOn(fs, 'pathExistsSync').mockImplementation(() => true);
   });

   afterEach(() => {
      stubPathExistsSync.mockRestore();
   });

   describe('constructor()', () => {
      let stubDetectPathToJinnee;
      let stubDetectPathToSDK;

      beforeEach(() => {
         stubDetectPathToJinnee = jest.spyOn(Jinnee.prototype, '_detectPathToJinnee').mockReturnValue('Jinnee');
         stubDetectPathToSDK = jest.spyOn(Jinnee.prototype, '_detectPathToSDK').mockReturnValue('SDK');
      });

      afterEach(() => {
         stubDetectPathToJinnee.mockRestore();
         stubDetectPathToSDK.mockRestore();
      });

      test('should create jinnee with default config', () => {
         const jinnee = new Jinnee(new ModulesMap(), buildOptions(), tsconfigPath, 'iAmService');

         expect(jinnee.servicePath).toStrictEqual('intest-ps/ui/resources');
         expect(jinnee.s3deployPath).toStrictEqual('src/stands/Jinnee/InTest.s3deploy');
         expect(jinnee.s3cldPath).toStrictEqual('src/stands/Jinnee/InTest.s3cld');
         expect(jinnee.service).toStrictEqual('iAmService');

         expectJinneeConfig(jinnee.config);
      });

      test('should return exception if Jinnee path does not exists', () => {
         stubPathExistsSync = jest.spyOn(fs, 'pathExistsSync').mockImplementation(() => false);

         expect.assertions(1);

         try {
            new Jinnee(new ModulesMap(), buildOptions(), tsconfigPath, 'iAmService');
         } catch (err) {
            expect(err.message).toStrictEqual('Jinnee does not exists on path "src/SDK/jinnee"');
         }
      });

      test('should detect SDK path if options pathToSDK not exists', () => {
         new Jinnee(new ModulesMap(), buildOptions({
            pathToSDK: undefined
         }), tsconfigPath, 'iAmService');

         expect(stubDetectPathToSDK.mock.calls.length).toStrictEqual(1);
      });

      test('should detect Jinnee path if options pathToJinnee not exists', () => {
         new Jinnee(new ModulesMap(), buildOptions({
            pathToJinnee: undefined
         }), tsconfigPath, 'iAmService');

         expect(stubDetectPathToJinnee.mock.calls.length).toStrictEqual(1);
      });
   });

   describe('_detectPathToSDK()', () => {
      const originalEnv = process.env;
      let jinnee;

      beforeEach(() => {
         process.env = { ...originalEnv };
         jinnee = new Jinnee(new ModulesMap(), buildOptions({
            rc: 'rc-22.1000'
         }), tsconfigPath, 'iAmService');
      });

      afterEach(() => {
         process.env = originalEnv;
      });

      test('should detect sdk from environment variable "sdk"', () => {
         process.env.SDK = 'src/newsdk';

         expect(jinnee._detectPathToSDK()).toStrictEqual('src/newsdk');
         expect(process.env.SBISPlatformSDK_221000).toStrictEqual('src/newsdk');
      });

      test('should detect sdk from environment variable "SBISPlatformSDK"', () => {
         process.env.SDK = undefined;
         process.env.SBISPlatformSDK_221000 = 'src/sdk_221000';

         expect(jinnee._detectPathToSDK()).toStrictEqual('src/sdk_221000');
         expect(process.env.SDK).toBeUndefined();
         expect(process.env.SBISPlatformSDK_221000).toStrictEqual('src/sdk_221000');
      });

      test('should return exception if sdk not installed', () => {
         process.env.SDK = undefined;
         process.env.SBISPlatformSDK_221000 = undefined;

         expect.assertions(1);

         try {
            jinnee._detectPathToSDK();
         } catch (err) {
            expect(err.message).toStrictEqual('221000 SDK not installed');
         }
      });

      test('should return exception if sdk does not exists on path from environment variable', () => {
         stubPathExistsSync = jest.spyOn(fs, 'pathExistsSync').mockImplementation(() => false);
         process.env.SDK = undefined;
         process.env.SBISPlatformSDK_221000 = 'src/221000_sdk';

         expect.assertions(1);

         try {
            jinnee._detectPathToSDK();
         } catch (err) {
            expect(err.message).toStrictEqual('SDK does not exists on path "src/221000_sdk"');
         }
      });
   });

   describe('_detectPathToJinnee()', () => {
      const originalEnv = process.env;
      let jinnee;

      beforeEach(() => {
         process.env = { ...originalEnv };
         jinnee = new Jinnee(new ModulesMap(), buildOptions(), tsconfigPath, 'iAmService');
      });

      afterEach(() => {
         process.env = originalEnv;
      });

      test('should return path to jinnee zip if environment variable "sdk" exists', () => {
         process.env.SDK = 'path/SDK';

         expect(jinnee._detectPathToJinnee()).toStrictEqual('src/SDK/tools/jinnee/jinnee.zip');
      });

      test('should return path to jinnee dir if environment variable "sdk" not exists', () => {
         process.env.SDK = undefined;

         expect(jinnee._detectPathToJinnee()).toStrictEqual('src/SDK/tools/jinnee');
      });
   });

   describe('_prepareDeployCfg()', () => {
      let stubReadXmlFile;
      let stubWriteXmlFile;
      let jinnee;

      function expectDeployConfig(config, system) {
         expect(config).toEqual({
            distribution_deploy_schema: {
               $: {
                  compiler: system === 'win32' ? 'clang' : 'default',
                  architecture: system === 'win32' ? 'i686' : 'default',
                  os: system === 'win32' ? 'windows' : 'default',
                  json_cache: 'build/cache'
               },
               gulp_config: [
                  {
                     $: {
                        path: 'src/logs/builderConfig.json'
                     }
                  }
               ],
               site: [
                  {
                     business_logic: [
                        {
                           $: {
                              target_path: 'build/application/workDir'
                           }
                        }
                     ],
                     static_content: [
                        {
                           $: {
                              target_path: 'build/application/workDir'
                           }
                        }
                     ]
                  }
               ],
            }
         });
      }

      beforeEach(() => {
         jinnee = new Jinnee(new ModulesMap(), buildOptions(), tsconfigPath, 'iAmService');

         stubReadXmlFile = jest.spyOn(xml, 'readXmlFile').mockImplementation(() => Promise.resolve({
            distribution_deploy_schema: {
               $: {
                  compiler: 'default',
                  architecture: 'default',
                  os: 'default',
                  json_cache: 'default/cache'
               },
               site: [
                  {
                     business_logic: [
                        {
                           $: {
                              target_path: 'default/dir'
                           }
                        }
                     ],
                     static_content: [
                        {
                           $: {
                              target_path: 'default/dir'
                           }
                        }
                     ]
                  }
               ]
            }
         }));
         stubWriteXmlFile = jest.spyOn(xml, 'writeXmlFile').mockReturnValue(Promise.resolve());
      });

      afterEach(() => {
         stubReadXmlFile.mockRestore();
         stubWriteXmlFile.mockRestore();
      });

      test('should build config stand for windows system', async() => {
         await jinnee._prepareDeployCfg('win32');

         expect(stubWriteXmlFile.mock.calls.length).toStrictEqual(1);
         expect(stubWriteXmlFile.mock.calls[0][0]).toStrictEqual('src/stands/Jinnee/InTest.s3deploy');
         expectDeployConfig(stubWriteXmlFile.mock.calls[0][1], 'win32');
      });

      test('should build config stand for linux system', async() => {
         await jinnee._prepareDeployCfg('linux');

         expect(stubWriteXmlFile.mock.calls.length).toStrictEqual(1);
         expect(stubWriteXmlFile.mock.calls[0][0]).toStrictEqual('src/stands/Jinnee/InTest.s3deploy');
         expectDeployConfig(stubWriteXmlFile.mock.calls[0][1], 'linux');
      });
   });

   describe('_prepareService()', () => {
      const parentService = {
         deleteModules: jest.fn(() => {}),
         save: jest.fn(() => Promise.resolve())
      };
      const service = {
         deleteModules: jest.fn(() => {}),
         addModules: jest.fn(() => Promise.resolve()),
         save: jest.fn(() => Promise.resolve())
      };
      let jinnee;

      service.getAllService = () => [service, parentService];

      beforeEach(() => {
         jinnee = new Jinnee(new ModulesMap({
            Module1: {
               type: 'ui',
               name: 'Module1',
               id: '1',
               s3mod: 'src/Module1'
            }
         }), buildOptions(), tsconfigPath, service);
      });

      test('should delete all modules from services and add modules to head service', async() => {
         await jinnee._prepareService();

         expect(parentService.deleteModules.mock.calls.length).toStrictEqual(1);
         expect(parentService.save.mock.calls.length).toStrictEqual(1);

         expect(service.deleteModules.mock.calls.length).toStrictEqual(1);
         expect(service.addModules.mock.calls.length).toStrictEqual(1);

         const addedModule = [...service.addModules.mock.calls[0][0]];

         expect(addedModule).toEqual([{
            id: '1',
            name: 'Module1',
            url: 'src/Module1'
         }]);

         expect(service.save.mock.calls.length).toStrictEqual(2);
      });
   });

   describe('_prepareJinnee()', () => {
      const stubStat = {
         isFile: jest.fn(() => true)
      };
      let stubStatSync;
      let stubCmdExecute;
      let jinnee;

      beforeEach(() => {
         jinnee = new Jinnee(new ModulesMap(), buildOptions(), tsconfigPath, 'iAmService');

         stubCmdExecute = jest.spyOn(jinnee.cmd, 'execute').mockImplementation(() => Promise.resolve());
         stubStatSync = jest.spyOn(fs, 'statSync').mockImplementation(() => stubStat);
      });

      afterEach(() => {
         stubCmdExecute.mockRestore();
         stubStatSync.mockRestore();
      });

      test('should unpack jinnee if it is pack', async() => {
         await jinnee._prepareJinnee();

         expect(jinnee.path).toStrictEqual('build/jinnee');
         expect(stubCmdExecute.mock.calls.length).toStrictEqual(1);
         expect(stubCmdExecute.mock.calls[0][0])
            .toStrictEqual('7za x src/SDK/jinnee -y -obuild/jinnee > /dev/null && chmod -R 0777 build/jinnee');
         expect(stubCmdExecute.mock.calls[0][1]).toStrictEqual(process.cwd());
      });
   });

   describe('_getJinneeDeployCli()', () => {
      let jinnee;

      beforeEach(() => {
         jinnee = new Jinnee(new ModulesMap(), buildOptions(), tsconfigPath, 'iAmService');
      });

      test('should return path for windows platform', () => {
         expect(jinnee._getJinneeDeployCli('win32'))
            .toStrictEqual('"src/SDK/jinnee/jinnee-utility.exe" jinnee-dbg-stand-deployment300.dll');
      });

      test('should return path for linux platform', () => {
         expect(jinnee._getJinneeDeployCli('linux'))
            .toStrictEqual('src/SDK/jinnee/jinnee-utility libjinnee-dbg-stand-deployment300.so');
      });
   });

   describe('_linkCDNModules()', () => {
      let stubBuilderLinkCDNModules;
      let stubEnsureSymlink;
      let jinnee;

      beforeEach(() => {
         jinnee = new Jinnee(new ModulesMap(), buildOptions(), tsconfigPath, 'iAmService');

         stubEnsureSymlink = jest.spyOn(fs, 'ensureSymlink').mockImplementation(() => Promise.resolve());
         stubBuilderLinkCDNModules = jest.spyOn(Builder.prototype, '_linkCDNModules')
            .mockImplementation(() => Promise.resolve());
      });

      afterEach(() => {
         stubEnsureSymlink.mockRestore();
         stubBuilderLinkCDNModules.mockRestore();
      });

      test('should create symlink on cdn directory', async() => {
         stubPathExistsSync.mockImplementation(() => false);

         await jinnee._linkCDNModules();

         expect(stubBuilderLinkCDNModules.mock.calls.length).toStrictEqual(1);
         expect(stubEnsureSymlink.mock.calls.length).toStrictEqual(1);
         expect(stubEnsureSymlink.mock.calls[0][0]).toStrictEqual('build/application/cdn');
         expect(stubEnsureSymlink.mock.calls[0][1]).toStrictEqual('intest-ps/ui/resources/cdn');
      });

      test('should not create symlink if cdn directory exists', async() => {
         await jinnee._linkCDNModules();

         expect(stubBuilderLinkCDNModules.mock.calls.length).toStrictEqual(1);
         expect(stubEnsureSymlink.mock.calls.length).toStrictEqual(0);
      });
   });

   describe('start()', () => {
      let stubCmdExecute;
      let stubGetJinneeDeployCli;
      let jinnee;

      beforeEach(() => {
         jinnee = new Jinnee(new ModulesMap(), buildOptions(), tsconfigPath, 'iAmService');

         stubCmdExecute = jest.spyOn(jinnee.cmd, 'execute').mockImplementation(() => Promise.resolve());
         stubGetJinneeDeployCli = jest.spyOn(jinnee, '_getJinneeDeployCli').mockImplementation(() => 'src/jinnee');
      });

      afterEach(() => {
         stubCmdExecute.mockRestore();
         stubGetJinneeDeployCli.mockRestore();
      });

      test('should start jinnee for build stand', async() => {
         await jinnee.start();

         expect(stubCmdExecute.mock.calls.length).toStrictEqual(1);
         expect(stubCmdExecute.mock.calls[0][0]).toEqual({
            env: 'src/jinnee',
            args: {
               project: 'src/stands/Jinnee/InTest.s3cld',
               deploy_stand: 'src/stands/Jinnee/InTest.s3deploy',
               logs_dir: 'build/application/workDir/logs'
            }
         });
         expect(stubCmdExecute.mock.calls[0][1]).toStrictEqual('src/SDK/jinnee');
         expect(stubCmdExecute.mock.calls[0][2]).toEqual({
            processName: 'jinnee-deploy',
            errorLabel: '[ERROR]'
         });
      });
   });

   describe('build()', () => {
      let stubReadMetaBuild;
      let stubBuildModules;
      let stubSaveConfig;
      let stubTslibInstall;
      let stubRrepareService;
      let stubPrepareDeployCfg;
      let stubPrepareJinnee;
      let stubStart;
      let stubLinkCDNModules;
      let stubSaveBuildMeta;
      let jinnee;

      beforeEach(() => {
         jinnee = new Jinnee(new ModulesMap(), buildOptions(), tsconfigPath, 'iAmService');

         stubReadMetaBuild = jest.spyOn(jinnee, '_readMetaBuild').mockReturnValue(Promise.resolve());
         stubBuildModules = jest.spyOn(jinnee, '_buildModulesListForConfig')
            .mockImplementation(() => Promise.resolve());
         stubSaveConfig = jest.spyOn(jinnee, 'saveConfig').mockImplementation(() => Promise.resolve());
         stubTslibInstall = jest.spyOn(jinnee, '_tslibInstall').mockImplementation(() => Promise.resolve());
         stubRrepareService = jest.spyOn(jinnee, '_prepareService').mockImplementation(() => Promise.resolve());
         stubPrepareDeployCfg = jest.spyOn(jinnee, '_prepareDeployCfg').mockImplementation(() => Promise.resolve());
         stubPrepareJinnee = jest.spyOn(jinnee, '_prepareJinnee').mockImplementation(() => Promise.resolve());
         stubStart = jest.spyOn(jinnee, 'start').mockImplementation(() => Promise.resolve());
         stubLinkCDNModules = jest.spyOn(jinnee, '_linkCDNModules').mockImplementation(() => Promise.resolve());
         stubSaveBuildMeta = jest.spyOn(jinnee, '_saveBuildMeta').mockImplementation(() => Promise.resolve());
      });

      afterEach(() => {
         stubReadMetaBuild.mockRestore();
         stubBuildModules.mockRestore();
         stubSaveConfig.mockRestore();
         stubTslibInstall.mockRestore();
         stubRrepareService.mockRestore();
         stubPrepareDeployCfg.mockRestore();
         stubPrepareJinnee.mockRestore();
         stubStart.mockRestore();
         stubLinkCDNModules.mockRestore();
         stubSaveBuildMeta.mockRestore();
      });

      test('should prepare config and environment and jinnee for build stand', async() => {
         await jinnee.build();

         expect(stubReadMetaBuild.mock.calls.length).toStrictEqual(1);
         expect(stubBuildModules.mock.calls.length).toStrictEqual(1);
         expect(stubSaveConfig.mock.calls.length).toStrictEqual(1);
         expect(stubTslibInstall.mock.calls.length).toStrictEqual(1);
         expect(stubRrepareService.mock.calls.length).toStrictEqual(1);
         expect(stubPrepareDeployCfg.mock.calls.length).toStrictEqual(1);
         expect(stubPrepareDeployCfg.mock.calls[0][0]).toStrictEqual(process.platform);
         expect(stubPrepareJinnee.mock.calls.length).toStrictEqual(1);
         expect(stubStart.mock.calls.length).toStrictEqual(1);
         expect(stubLinkCDNModules.mock.calls.length).toStrictEqual(1);
         expect(stubSaveBuildMeta.mock.calls.length).toStrictEqual(1);
      });

      test('should save meta build if build fail', async() => {
         stubStart.mockImplementation(() => Promise.reject('Build fail'));

         await expect(jinnee.build()).rejects.toMatch('Build fail');

         expect(stubReadMetaBuild.mock.calls.length).toStrictEqual(1);
         expect(stubBuildModules.mock.calls.length).toStrictEqual(1);
         expect(stubTslibInstall.mock.calls.length).toStrictEqual(1);
         expect(stubRrepareService.mock.calls.length).toStrictEqual(1);
         expect(stubSaveConfig.mock.calls.length).toStrictEqual(1);
         expect(stubPrepareJinnee.mock.calls.length).toStrictEqual(1);
         expect(stubPrepareDeployCfg.mock.calls.length).toStrictEqual(1);
         expect(stubPrepareDeployCfg.mock.calls[0][0]).toStrictEqual(process.platform);
         expect(stubStart.mock.calls.length).toStrictEqual(1);
         expect(stubLinkCDNModules.mock.calls.length).toStrictEqual(0);
         expect(stubSaveBuildMeta.mock.calls.length).toStrictEqual(1);
      });
   });
});
