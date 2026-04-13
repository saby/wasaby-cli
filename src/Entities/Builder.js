const fs = require('fs-extra');

const pathUtils = require('../Utils/path');
const Server = require('../Server/Server');
const logger = require('../Utils/Logger');
const NodeJS = require('../Process/NodeJS');
const Module = require('../Module/Module');

const ES_VERSION = 2021;
const BUILDER_FLAGS = {
   tsc: true,
   mode: 'stand',
   typescript: true,
   contents: true,
   joinedMeta: true,
   less: true,
   resourcesUrl: false,
   modules: [],
   outputIsCache: true,
   jsonToLess: true,
};
const FLAGS_OF_RELEASE_MODE = {
   minimize: true,
   wml: true,
   customPack: true,
   dependenciesGraph: true,
   htmlWml: true
};
const FLAGS_OF_PATCH_MODE = {
   ...FLAGS_OF_RELEASE_MODE,
   checkDependenciesGraph: false,
   deprecatedOwnDependencies: true,
   deprecatedStaticHtml: true,
   compress: true,
   deprecatedXhtml: true,
   sources: true,
   presentationServiceMeta: true,
   deprecatedWebPageTemplates: true,
   debugReactPS: false,
   cdnUrl: '/cdn/',
   staticService: true,
   desktop: false,
   outputIsCache: false,
   jsonToLess: false,
   resourcesUrl: true,
   clearOutput: true,
};
const DEFAULT_PORT_HOT_RELOAD = 3000;
const REG_EXP_ROUTER_OBJ = /return \{[\w\W]+};/;
const STDOUT_MESSAGE_START_RE = /^\[\d+:\d+:\d+]\s/;

function translate(key, dict, plural) {
   const result = key.split(/@@|#/).reverse()[0];

   if (plural) {
      return dict[key] ? dict[key].split('|')[0] : result;
   }

   return dict[key] || result;
}

function removeColors(text) {
   return text
      .replace(/\\u[0-9a-zA-Z]{4}(\[[0-9]+m)?/g, '')
      .replace(/\\x[0-9a-zA-Z]{1,6}(\[[0-9]+m)?/g, '');
}

function splitDataChunk(text) {
   const chunks = [];
   let tail = '';

   const lines = text.split('\n');

   let currentLine = '';
   for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (!STDOUT_MESSAGE_START_RE.test(line)) {
         currentLine += `\n${line}`;

         continue;
      }

      if (currentLine !== '') {
         chunks.push(removeColors(currentLine));
      }

      currentLine = line;
   }

   if (currentLine !== '') {
      chunks.push(removeColors(currentLine));
   }

   return {
      chunks,
      tail
   };
}

class Builder {
   constructor(modules, options, tsconfig, requiredFeature, routingMap) {
      this.options = options;
      this.modules = modules;
      this.buildModules = [];

      this.path = require.resolve('sbis3-builder/gulpfile.js');
      this.configPath = pathUtils.join(logger.dir, 'builderConfig.json');
      this.gulpPath = require.resolve('gulp/bin/gulp.js');
      this.nodeModulesPath = pathUtils.join(process.cwd(), 'node_modules');
      this.requiredFeature = requiredFeature || [];
      this.routerMap = routingMap || {};

      this.config = {
         logs: pathUtils.join(logger.dir, 'builderLogs'),
         tsconfig: tsconfig,
         output: this.options.get('resources'),
         cache: this.options.get('builderCache'),
         symlinks: !this.options.get('copy'),
         sourceMaps: this.options.get('sourceMaps'),
         inlineSourceMaps: this.options.get('inlineSourceMaps'),
         ESVersion: this.options.get('esVersion'),
         version: `${this.options.get('rc').replace('rc-', '')}-1`,
         regionPlaceholdersPath: pathUtils.join(logger.dir, 'regionPlaceholdersPath.json'),

         // передаём в билдер путь до wasaby-cli/node_modules, поскольку помимо стандартных типов для компилятора
         // (например react) там хранятся ещё и библиотеки, которые нужны только для модулей юнит-тестирования и
         // поставляться в SDK вместе с билдером не должны.
         nodeModules: this.nodeModulesPath,

         // TODO Временное решение, нудно научиться пересобирать только изменённые файлы и в локальных проектах.
         //  https://online.sbis.ru/opendoc.html?guid=487cac8a-245e-4b28-a411-5dd6440d677f
         clearOutput: !!this.options.get('isLocaleProject'),

         // TODO временная опция для тестирования umd модулей. В будущем umd должен стать значением по умолчанию.
         moduleType: this.options.get('umd') ? 'umd' : 'amd',
         ...BUILDER_FLAGS
      };

      if (this.options.get('extensionForTemplate')) {
         this.config.extensionForTemplate = this.options.get('extensionForTemplate');
      }

      if (this.options.get('disableSources')) {
         this.config.sources = false;
         this.config.outputIsCache = false;
      }

      if (this.options.get('disableMetatypes')) {
         this.config.metatypes = false;
      }

      if (this.options.get('disableFontsGenerate')) {
         this.config.disableFontsGenerate = true;
      }

      if (this.options.get('projectReferences')) {
         this.config.projectReferences = true;
      }

      if (this.options.get('hooksPath')) {
         this.config.hooksPath = this.options.get('hooksPath');
      }

      if (this.options.get('maxWorkers')) {
         this.config['max-workers-for-builder'] = this.options.get('maxWorkers');
      }

      if (this.options.get('countries')) {
         this.config.countries = this.options.get('countries');
      }

      if (!this.config.cache) {
         this.config.cache = pathUtils.join(pathUtils.dirname(this.config.output), 'build-ui/builder-json-cache');
      }

      if (this.options.get('reactVersion')) {
         this.config.reactVersion = Number(this.options.get('reactVersion'));
      }

      this.metaInfoPath = pathUtils.join(this.config.output, 'metaInfo.json');

      if (this.options.get('release')) {
         this.config = { ...this.config, ...FLAGS_OF_RELEASE_MODE };
      }

      if (this.options.get('buildPatch')) {
         this.config = { ...this.config, ...FLAGS_OF_PATCH_MODE, ...this.options.get('patchConfig') };
      }

      const localization = this.options.get('localization');

      if (localization && localization.length !== 0) {
         this.config.localization = localization;
         this.config['default-localization'] = localization[0];
      }
   }

   /**
    * Компилирует ресурсы проекта.
    * @return {Promise<void>}
    */
   async build() {
      logger.info('Preparing to building application');

      let hasError = false;

      await this._readMetaBuild();

      await Promise.all([
         this._buildModulesListForConfig(),
         this._prepareHotReload(),
         this._tslibInstall(),
         this._createConfigRegionPlaceholder(),
      ]);

      await this.saveConfig();

      try {
         await this.startBuild();
      } catch (err) {
         hasError = true;

         if (this.options.get('force')) {
            logger.error(err.toString());
            logger.info('The project build was finished with errors but you used flag --force and relieved us of responsibility for all further errors! :)');
         } else {
            throw err;
         }
      } finally {
         if (!hasError || this.options.get('force')) {
            await Promise.all([
               this._linkCDNModules(),
               this._linkPythonModules(),
               this._buildRouterMap(this.config.output),
            ]);
         }

         await this._saveBuildMeta();
      }
   }

   /**
    * Запускает watcher, который следит за изменениями в исходным коде и на лету перекомпилирует изменённые файлы.
    * @param onChangeCallback {Function} Функция, которая будет вызвана при изменении какого-либо модуля.
    * @return {Promise<void>}
    */
   async watcher(onChangeCallback) {
      const promises = [];

      if (this.options.get('hotReload')) {
         promises.push(this.startHotReload());
      }

      promises.push(this.startWatcher(onChangeCallback));

      await Promise.all(promises);
   }

   async saveConfig() {
      await fs.outputFile(this.configPath, JSON.stringify(this.config, null, 4));
   }

   startWatcher(onChangeCallback) {
      logger.info('Starting watcher');

      const stdoutHandler = Builder.createStdoutHandler();

      const onMessageCallback = async(files) => {
         if (files.fullRebuild === true) {
            await this._linkCDNModules();
         }

         if (onChangeCallback) {
            await onChangeCallback(files);
         }
      };

      const subprocess = new NodeJS({
         type: 'fork',
         exeFile: this.gulpPath,
         command: 'buildOnChangeWatcher',
         options: {
            config: this.configPath,
            gulpfile: this.path,
            'log-level': this.options.get('logLevel')
         },
         processName: 'builderWatcher',
         onData: stdoutHandler,
         onError: stdoutHandler,
         onMessage: onMessageCallback
      });

      return subprocess.run();
   }

   async startHotReload() {
      const hotReloadServer = new NodeJS({
         exeFile: pathUtils.join(this.modules.get('db97ce92-b7ce-4ff3-9649-dc43fd3c36bf').path, 'eventStream/third-party/server'),
         options: {
            port: this.hotReloadPort
         },
         procOptions: {
            cwd: process.cwd()
         },
         processName: 'hotReload'
      });

      await hotReloadServer.run();
   }

   async startBuild() {
      logger.info('Starting build application');

      const stdoutHandler = Builder.createStdoutHandler();

      const buildProc = new NodeJS({
         exeFile: this.gulpPath,
         command: 'build',
         options: {
            config: this.configPath,
            gulpfile: this.path,
            'log-level': this.options.get('logLevel')
         },
         procOptions: {
            cwd: process.cwd()
         },
         processName: 'builder',
         onData: stdoutHandler,
         onError: stdoutHandler
      });

      await buildProc.run();
   }

   async _saveBuildMeta() {
      logger.info('Saving modules info');

      const status = {
         version: this.config.version,
         stable: false,
         builderOptions: {
            copy: this.options.get('copy'),
            umd: this.options.get('umd')
         },
         date: new Date().toISOString()
      };
      const pathModulesStats = pathUtils.join(this.config.logs, 'modules_stats.json');

      if (fs.pathExistsSync(pathModulesStats)) {
         const buildStatus = fs.readJsonSync(pathModulesStats);
         let hasError = false;

         if (buildStatus.cacheIsDropped) {
            this.metaInfo = new Map();
         }

         for (const module of this.modules.values()) {
            if (buildStatus.modules[module.name] === 'PASSED') {
               module.updateRevision();
               this.metaInfo.set(module.name, module);
            } else {
               hasError = true;
            }
         }

         status.stable = !hasError;
      }

      const serializeModules = {};

      for (const [name, module] of this.metaInfo) {
         serializeModules[name] = module.serialize();
      }

      const serializeCache = JSON.stringify(serializeModules, null, 3);
      const serializeStatus = JSON.stringify(status, null, 3);

      await Promise.all([
         fs.outputFile(pathUtils.join(this.config.output, 'status.json'), serializeStatus),
         logger.writeFile('status.json', serializeStatus),
         fs.outputFile(this.metaInfoPath, serializeCache),
         logger.writeFile('buildModules.json', serializeCache)
      ]);
   }

   async _readMetaBuild() {
      this.metaInfo = new Map();

      if (!fs.pathExistsSync(this.metaInfoPath) || !this.options.get('onlyChanges')) {
         return;
      }

      try {
         const metaInfoCache = await fs.readJson(this.metaInfoPath);

         for (const [name, moduleInfo] of Object.entries(metaInfoCache)) {
            this.metaInfo.set(name, Module.buildModuleFromObject(moduleInfo));
         }
      } catch (err) {
         logger.debug(`Error reading meta info prevision build. Error: ${err}`);
         logger.info('Can\'t read meta info about prevision build. Force rebuild all modules.');

         this.config.forceRebuild = true;
      }
   }

   async _createConfigRegionPlaceholder() {
      const result = {};
      const locConfigs = this.modules.get('42b71438-721f-4b7c-8dfa-443444d7a0e7');
      const regions = new Set();
      const regionPath = pathUtils.join(locConfigs.path, 'localization_configs/region');

      for (const nameFile of (await fs.readdir(regionPath))) {
         regions.add(require(pathUtils.join(regionPath, nameFile)));
      }

      for (const langCode of (this.config.localization || ['ru'])) {
         const dict = require(pathUtils.join(locConfigs.repository.path, 'www/service/Модули/i18n/lang', `${langCode}.json`));
         const langConfig = {};

         for (const region of regions) {
            const regionConfig = {
               '%notranslates_cur_name_one%': translate(`CurrencyLocalization@@plural#${region.Money.plural}`, dict, true),
               '%notranslates_cur_name_one_cap%': translate(`CurrencyLocalizationCap@@plural#${region.Money.plural}`, dict, true),
               '%notranslates_cur_name_plural%': translate(`CurrencyLocalizationLowerMany@@${region.Money.currencyMany}`, dict),
               '%notranslates_cur_name_plural_cap%': translate(`CurrencyLocalizationMany@@${region.Money.currencyManyCap}`, dict),
               '%notranslates_cur_sign%': region.Money.symbol,
               '%notranslates_ecos_name%': region.Ecosystem.name,
               '%notranslates_inn_name%': translate(`TINName@@${region.Ecosystem.TINName}`, dict),
            };

            langConfig[region.code] = regionConfig;
         }

         result[langCode] = langConfig;
      }

      await fs.outputFile(this.config.regionPlaceholdersPath, JSON.stringify(result, null, 3));
   }

   /**
    * Копирует tslib.js и глобальные переменные в модуль WS.Core.
    * tslib.js используется в продакшене, поэтом приходится добавлять его в сборку.
    */
   async _tslibInstall() {
      logger.info('Installing tslib and global types in WS.Core');

      const wsCore = this.modules.get('0df0fce3-53ba-47f8-987d-edf1fd078295');

      // If there is no WS.Core in the project therefore nothing to install
      if (!wsCore) {
         return;
      }

      try {
         const tsPath = require.resolve('saby-typescript/cli/install.js');
         const wsGlobalTyping = pathUtils.join(wsCore.path, 'global.d.ts');

         const copyTsLibProc = new NodeJS({
            exeFile: tsPath,
            options: {
               tsconfig: 'skip',
               tslint: 'skip',
               tslib: 'skip',
               globalTypings: wsGlobalTyping
            },
            procOptions: {
               cwd: process.cwd()
            },
            force: true,
            processName: 'typescriptInstall'
         });

         await copyTsLibProc.run();
      } catch (e) {
         logger.error(`Error installing tslib and global types in WS.Core: ${e}`);
      }
   }

   injectLoadAfterModules(loadAfterModules, addableModules) {
      let loadAfterListIsEmpty = loadAfterModules.size === 0;

      while (!loadAfterListIsEmpty) {
         const loadAfterModulesSize = loadAfterModules.size;

         for (const [name, info] of loadAfterModules) {
            let leadModuleIsLoadAfter = false;

            for (const leadModule of info.module.loadAfter) {
               if (loadAfterModules.has(leadModule)) {
                  leadModuleIsLoadAfter = true;

                  break;
               }
            }

            if (!leadModuleIsLoadAfter) {
               addableModules.push(info);
               loadAfterModules.delete(name);
            }
         }

         if (loadAfterModulesSize === loadAfterModules.size) {
            throw new Error(`Modules "${[...loadAfterModules.keys()]}" has cycle dependencies in "load_after" construction.`);
         }

         loadAfterListIsEmpty = loadAfterModules.size === 0;
      }
   }

   convertChangedFiles(files, modulePath) {
      const result = [];

      for (const filePath of files) {
         result.push(filePath.replace(modulePath, '.'));
      }

      return result;
   }

   /**
    * Формирует список модулей проекта в формате необходимом для конфигурации сборщика.
    */
   async _buildModulesListForConfig() {
      logger.info('Building modules for builder config');

      this.config.modules = [];
      const featuresProvidedModules = new Map();
      const moduleVersions = this.options.get('moduleVersions') || {};

      for (const module of this.modules.values()) {
         if (module.environment === 'Python') {
            continue;
         }

         if (module.name === 'HotReload' && this.options.get('isLocaleProject') && !this.options.get('hotReload')) {
            continue;
         }

         const builderConfigModule = {
            id: module.id,
            name: module.name,
            path: module.path,
            required: module.required,
            featuresProvided: module.featuresProvided && [...module.featuresProvided.values()],
            featuresRequired: module.featuresRequired && [...module.featuresRequired.values()],
            depends: Object.values(module.depends),
            service: ['intest-ps'],
            kaizen: module.kaizen,
            typescript: module.typescript,
            version: moduleVersions[module.name]
         };

         if (this.metaInfo.has(module.name)) {
            const previsionModule = this.metaInfo.get(module.name);
            const revisions = previsionModule.revision;

            if (revisions) {
               try {
                  const changedFiles = await module.getChangedFiles(revisions);

                  builderConfigModule.changedFiles = this.convertChangedFiles(changedFiles.changed, module.path);
                  builderConfigModule.deletedFiles = this.convertChangedFiles(changedFiles.deleted, module.path);
               } catch (error) {
                  this.metaInfo.delete(module.name);
                  builderConfigModule.forceRebuild = true;

                  logger.info(`Couldn't get correct diff for module ${module.name} for revision ${revisions} from repositories ${previsionModule.repository}. Error: ${error}`);
               }
            }
         }

         if (module.type === 'test') {
            builderConfigModule.minimize = false;
            builderConfigModule.deprecatedXhtml = false;
            builderConfigModule.wml = false;
            builderConfigModule.ESVersion = ES_VERSION;
         }

         if (module.forCDN) {
            builderConfigModule.minimize = false;
            builderConfigModule.ESVersion = ES_VERSION;
            builderConfigModule.parse = false;
         }

         if (module.featuresProvided && module.featuresProvided.size !== 0) {
            featuresProvidedModules.set(
               module.name,
               {
                  module,
                  builderConfigModule
               }
            );
         } else {
            this.config.modules.push(builderConfigModule);
            this.buildModules.push(module);
         }
      }

      this.injectFeaturesProvidedModules(featuresProvidedModules);
   }

   injectFeaturesProvidedModules(modules) {
      const addableModules = [];
      const loadAfterModules = new Map();
      const requiredFeature = new Set();
      let detectedFeature = [];

      for (const {module, builderConfigModule} of modules.values()) {
         if (this.requiredFeature.includes(module.id)) {
            requiredFeature.add({builderConfigModule, module});
            detectedFeature = [...detectedFeature, ...module.featuresProvided.keys()];

            continue;
         }

         if (module.loadAfter && module.loadAfter.length !== 0) {
            loadAfterModules.set(
               module.name,
               {
                  module,
                  builderConfigModule
               }
            );
         } else {
            addableModules.push({module, builderConfigModule});
         }
      }

      this.injectLoadAfterModules(loadAfterModules, addableModules);

      for (const {module, builderConfigModule} of addableModules) {
         this.config.modules.push(builderConfigModule);

         if (!detectedFeature.includes(module.featuresProvided.values().next().value.name) || this.isDependence(module)) {
            this.buildModules.push(module);
         }
      }

      for (const {builderConfigModule, module} of requiredFeature) {
         this.config.modules.push(builderConfigModule);
         this.buildModules.push(module);
      }
   }

   isDependence(checkModule) {
      for (const module of this.modules.values()) {
         if (module.depends.hasOwnProperty(checkModule.id)) {
            return true;
         }
      }

      return false;
   }

   /**
    * Запускает сервер хотрелоада.
    */
   async _prepareHotReload() {
      if (this.options.get('hotReload')) {
         this.hotReloadPort = await Server.detectAvailablePort(
             this.options.get('hotReloadPort') || DEFAULT_PORT_HOT_RELOAD
         );

         this.config.staticServer = `localhost:${this.hotReloadPort}`;
      }
   }

   /**
    * Создает симлинки на cdn ресурсы
    */
   async _linkCDNModules() {
      const promises = [];
      const CDNDir = pathUtils.join(this.config.output, 'cdn');

      if (fs.pathExistsSync(CDNDir)) {
         await fs.remove(CDNDir);
      }

      fs.ensureDirSync(CDNDir);

      for (const module of this.modules.values()) {
         if (module.forCDN) {
            promises.push((async() => {
               const source = pathUtils.join(this.config.output, module.name);
               const target = pathUtils.join(CDNDir, module.name);

               try {
                  await fs.ensureSymlink(source, target);
               } catch (err) {
                  logger.error(`Error creating symlink cdn module ${module.name} from ${source} to ${target}:  ${err}`);
               }
            })());
         }
      }

      await Promise.all(promises);
   }

   async _linkPythonModules() {
      const promises = [];
      const pythonTestDir = this.options.get('pythonTestDir')
          || pathUtils.join(this.options.get('artifactsDir') || logger.dir, 'PythonTest');

      if (fs.pathExistsSync(pythonTestDir)) {
         await fs.remove(pythonTestDir);
      }

      fs.ensureDirSync(pythonTestDir);

      for (const module of this.modules.values()) {
         if (module.environment === 'Python') {
            promises.push((async() => {
               const source = module.path;
               const target = pathUtils.join(pythonTestDir, module.name);

               try {
                  await fs.ensureSymlink(source, target);
               } catch (err) {
                  logger.error(`Error creating symlink Python Test module ${module.name} from ${source} to ${target}:  ${err}`);
               }
            })());
         }
      }

      await Promise.all(promises);
   }

   async _buildRouterMap(root) {
      const pathRouterJson = pathUtils.join(root, 'router.json');
      const pathRouterJS = pathUtils.join(root, 'router.js');
      const pathRouterMinJS = pathUtils.join(root, 'router.min.js');

      if (fs.existsSync(pathRouterJson)) {
         await fs.writeJSON(pathRouterJson, this.routerMap);
      }

      if (fs.existsSync(pathRouterJS)) {
         const content = await fs.readFile(pathRouterJS, 'utf-8');

         await fs.outputFile(pathRouterJS, content.replace(REG_EXP_ROUTER_OBJ, `return ${JSON.stringify(this.routerMap)};`));
      }

      if (fs.existsSync(pathRouterMinJS)) {
         const content = await fs.readFile(pathRouterMinJS, 'utf-8');

         await fs.outputFile(pathRouterMinJS, content.replace(REG_EXP_ROUTER_OBJ, `return ${JSON.stringify(this.routerMap)};`));
      }
   }

   static createStdoutHandler() {
      let tail = '';
      let chunks;

      return (data, result, errors) => {
         ({ tail, chunks } = splitDataChunk(tail + data));

         for (const chunk of chunks) {
            if (chunk.includes('[ERROR]')) {
               errors.push(chunk);
            } else {
               result.push(chunk);
            }
         }
      };
   }
}

module.exports = Builder;
