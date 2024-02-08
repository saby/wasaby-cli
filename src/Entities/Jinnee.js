const fs = require('fs-extra');
const pMap = require('p-map');

const Builder = require('./Builder');
const pathUtils = require('../Utils/path');
const xml = require('../Utils/xml');
const logger = require('../Utils/Logger');
const ChildProcess = require('../Process/ChildProcess');

const BUILDER_FLAGS = {
   cld_name: 'InTest',
   cld_responsible: 'Ларионова А.В.',
   resourcesUrl: true,
   branchTests: true,
   lessCoverage: true,
   presentationServiceMeta: true,

   localization: [
      'en-US',
      'ru-RU'
   ],
   'default-localization': 'ru-RU',

   deprecatedStaticHtml: false,
   deprecatedXhtml: true,
   deprecatedWebPageTemplates: true,
   deprecatedOwnDependencies: true,

   'multi-service': false,
   'url-service-path': '/',
   'ui-service-path': '/',
   'url-default-service-path': '',

   // Release flags
   minimize: true,
   wml: true,
   customPack: true,
   dependenciesGraph: true,
   htmlWml: true
};

const DEBUG_FLAGS = {
   deprecatedOwnDependencies: false,
   tscCache: false,
   minimize: false,
   customPack: false,
   wml: false
};

class Jinnee extends Builder {
   constructor(modules, options, tsconfig, service) {
      super(modules, options, tsconfig);

      this.config = { ...this.config, ...BUILDER_FLAGS };

      // Сделан для сборки покрытия, в релизи сборка может идти целый день.
      if (this.options.get('debug')) {
         this.config = { ...this.config, ...DEBUG_FLAGS };
      }

      this.service = service;
      this.servicePath = pathUtils.join(this.options.get('resources'), '../../intest-ps/ui/resources');
      this.s3deployPath = pathUtils.join(this.options.get('projectDir'), 'InTest.s3deploy');
      this.s3cldPath = pathUtils.join(this.options.get('projectDir'), 'InTest.s3cld');

      this.sdkPath = this.options.get('pathToSDK') || this._detectPathToSDK();
      this.path = this.options.get('pathToJinnee') || this._detectPathToJinnee();

      if (!fs.pathExistsSync(this.path)) {
         throw new Error(`Jinnee does not exists on path "${this.path}"`);
      }
   }

   async build() {
      await this._readMetaBuild();
      await this._buildModulesListForConfig();

      logger.info('Preparing to building application');

      await Promise.all([
         this.saveConfig(),
         this._tslibInstall(),
         this._convertThemes(),
         this._prepareService(),
         this._prepareDeployCfg(process.platform),
         this._prepareJinnee()
      ]);

      try {
         await this.start();

         await this._linkCDNModules();
      } catch (err) {
         throw err;
      } finally {
         await this._saveBuildMeta();
      }
   }

   async start() {
      logger.info('Starting jinnee-utility');

      const buildProc = new ChildProcess({
         env: this._getJinneeDeployCli(process.platform),
         options: {
            project: this.s3cldPath,
            deploy_stand: this.s3deployPath,
            logs_dir: pathUtils.join(this.options.get('workDir'), 'logs')
         },
         procOptions: {
            cwd: this.path
         },
         processName: 'jinnee-deploy',
         onData: Builder.checkError
      });

      return buildProc.run();
   }

   async _linkCDNModules() {
      await super._linkCDNModules();

      const target = pathUtils.join(this.servicePath, 'cdn');

      if (!fs.pathExistsSync(target)) {
         await fs.ensureSymlink(pathUtils.join(this.config.output, 'cdn'), target);
      }
   }

   _detectPathToSDK() {
      const sdkVersion = this.options.get('rc').replace('rc-', '').replace('.', '');
      const pathToSDK = process.env.SDK || process.env['SBISPlatformSDK_' + sdkVersion];

      if (!pathToSDK) {
         throw new Error(`${sdkVersion} SDK not installed`);
      }

      if (!fs.pathExistsSync(pathToSDK)) {
         throw new Error(`SDK does not exists on path "${pathToSDK}"`);
      }

      // Прокидываем значение в переменную, чтобы jinnee смог найти sdk.
      process.env['SBISPlatformSDK_' + sdkVersion] = pathToSDK;

      return pathToSDK;
   }

   /**
    * Возвращает путь до папки с джином, если джин в архиве распаковывает в рабочую директорию
    * @returns {String}
    */
   _detectPathToJinnee() {
      return pathUtils.join(this.sdkPath, 'tools', 'jinnee', process.env.SDK ? 'jinnee.zip' : '');
   }

   /**
    * Возвращает путь до исполняемого файла джина.
    * @returns {string}
    * @public
    */
   _getJinneeDeployCli(platform) {
      if (platform === 'win32') {
         return `"${pathUtils.join(this.path, 'jinnee-utility.exe')}" jinnee-dbg-stand-deployment300.dll`;
      }

      return `${pathUtils.join(this.path, 'jinnee-utility')} libjinnee-dbg-stand-deployment300.so`;
   }

   /**
    *
    * @return {Promise<void>}
    * @private
    */
   async _prepareJinnee() {
      if (fs.statSync(this.path).isFile()) {
         // TODO https://online.sbis.ru/opendoc.html?guid=9c279079-9ff1-481a-83c5-4e1632740b2b
         const unpack = pathUtils.join(pathUtils.dirname(this.options.get('artifactsDir')), 'jinnee');

         logger.info('Starting unpack jinnee');

         const unzipProc = new ChildProcess({
            commandLine: `7za x ${this.path} -y -o${unpack} > /dev/null && chmod -R 0777 ${unpack}`,
            procOptions: {
               cwd: process.cwd()
            }
         });

         await unzipProc.run();

         logger.info('Finished unpacking jinnee');

         this.path = unpack;
      }
   }

   /**
    * Заменяет константы в .deploy
    * @private
    */
   async _prepareDeployCfg(platform) {
      logger.info('Preparing deploy service(s3deploy)');

      const deployConfig = await xml.readXmlFile(this.s3deployPath);
      const business_logic = deployConfig.distribution_deploy_schema.site[0].business_logic;
      const static_content = deployConfig.distribution_deploy_schema.site[0].static_content;

      business_logic[0].$.target_path = this.options.get('workDir');
      static_content[0].$.target_path = this.options.get('workDir');

      deployConfig.distribution_deploy_schema.$.json_cache = this.options.get('builderCache');

      if (platform === 'win32') {
         deployConfig.distribution_deploy_schema.$.compiler = 'clang';
         deployConfig.distribution_deploy_schema.$.architecture = 'i686';
         deployConfig.distribution_deploy_schema.$.os = 'windows';
      }


      deployConfig.distribution_deploy_schema.gulp_config = [
         {
            $: {
               path: this.configPath
            }
         }
      ];

      await xml.writeXmlFile(this.s3deployPath, deployConfig);
   }

   async _prepareService() {
      logger.info('Adding modules in service(s3srv)');

      const modules = new Set();
      const services = await this.service.getAllService();

      await pMap(services, async(service) => {
         service.deleteModules();
         await service.save();
      }, {
         concurrency: 10
      });

      for (const module of this.modules.getModules()) {
         modules.add({
            id: module.id,
            name: module.name,
            url: module.s3mod
         });
      }

      await this.service.addModules(modules);
      await this.service.save();
   }
}

module.exports = Jinnee;
