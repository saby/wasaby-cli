const fs = require('fs-extra');

const pathUtils = require('../Utils/path');
const ModulesMap = require('../Map/Modules');
const Server = require('../Server/Server');
const logger = require('../Utils/Logger');
const CMD = require('../Utils/CMD');

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
   useReact: true
};
const FLAGS_OF_RELEASE_MODE = {
   minimize: true,
   wml: true,
   customPack: true,
   dependenciesGraph: true,
   htmlWml: true
};
const DEFAULT_PORT_HOT_RELOAD = 3000;

class Builder {
   constructor(modules, options, tsconfig) {
      this.options = options;
      this.modules = modules;
      this.cmd = new CMD();

      this.path = require.resolve('sbis3-builder/gulpfile.js');
      this.configPath = pathUtils.join(logger.dir, 'builderConfig.json');
      this.gulpPath = require.resolve('gulp/bin/gulp.js');

      this.config = {
         logs: pathUtils.join(logger.dir, 'builderLogs'),
         tsconfig: tsconfig,
         output: this.options.get('resources'),
         cache: this.options.get('builderCache'),
         symlinks: !this.options.get('copy'),
         sourceMaps: this.options.get('sourceMaps'),
         inlineSourceMaps: this.options.get('inlineSourceMaps'),

         // TODO Временное решение, нудно научиться пересобирать только изменённые файлы и в локальных проектах.
         //  https://online.sbis.ru/opendoc.html?guid=487cac8a-245e-4b28-a411-5dd6440d677f
         clearOutput: !!this.options.get('isLocaleProject'),

         // TODO временная опция для тестирования umd модулей. В будущем umd должен стать значением по умолчанию.
         moduleType: this.options.get('umd') ? 'umd' : 'amd',
         ...BUILDER_FLAGS
      };

      if (this.options.get('hooksPath')) {
         this.config.hooksPath = this.options.get('hooksPath');
      }

      if (!this.config.cache) {
         this.config.cache = pathUtils.join(pathUtils.dirname(this.config.output), 'build-ui/builder-json-cache');
      }

      this.metaInfoPath = pathUtils.join(this.config.output, 'metaInfo.json');

      if (this.options.get('release')) {
         this.config = { ...this.config, ...FLAGS_OF_RELEASE_MODE };
      }

      const localization = this.options.get('localization');

      if (localization && localization.length !== 0) {
         this.config.localization = this.options.get('localization');
         this.config['default-localization'] = this.options.get('localization')[0];
      }
   }

   /**
    * Компилирует ресурсы проекта.
    * @return {Promise<void>}
    */
   async build() {
      logger.info('Preparing to building application');

      await this._readMetaBuild();

      await Promise.all([
         this._buildModulesListForConfig(),
         this._prepareHotReload(),
         this._tslibInstall()
      ]);

      await this.saveConfig();

      try {
         await this.startBuild();
      } catch (err) {
         throw err;
      } finally {
         await this._linkCDNModules();
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

      const subprocess = CMD.fork(
         this.gulpPath,
         [
            'buildOnChangeWatcher',
            `--config=${this.configPath}`,
            `--gulpfile=${this.path}`
         ],
         {
            processName: 'builderWatcher',
            errorLabel: '[ERROR]'
         }
      );

      if (typeof onChangeCallback === 'function') {
         subprocess.on('message', onChangeCallback);
      } else {
         // Выключить IPC канал, если обмен данными по нему не предполагается
         subprocess.disconnect();
      }

      return subprocess;
   }

   async startHotReload() {
      await this.cmd.execute(
         {
            file: pathUtils.join(this.modules.get('HotReload').path, 'eventStream/third-party/server'),
            args: {
               port: this.hotReloadPort
            }
         },
         process.cwd(),
         {
            processName: 'hotReload'
         }
      );
   }

   async startBuild() {
      logger.info('Starting build application');

      await this.cmd.execute(
         {
            file: this.gulpPath,
            command: 'build',
            args: {
               config: this.configPath,
               gulpfile: this.path,
               'log-level': this.options.get('logLevel')
            }
         },
         process.cwd(),
         {
            processName: 'builder',
            errorLabel: '[ERROR]'
         }
      );
   }

   async _saveBuildMeta() {
      logger.info('Saving modules info');

      const status = {
         stable: false,
         date: new Date().toISOString()
      };
      const pathModulesStats = pathUtils.join(this.config.logs, 'modules_stats.json');

      if (fs.pathExistsSync(pathModulesStats)) {
         const buildStatus = fs.readJsonSync(pathModulesStats);
         let hasError = false;

         if (buildStatus.cacheIsDropped) {
            this.metaInfo = new ModulesMap();
         }

         for (const module of this.modules.getModules()) {
            if (buildStatus.modules[module.name] === 'PASSED') {
               module.updateRevision();
               this.metaInfo.add(module);
            } else {
               hasError = true;
            }
         }

         status.stable = !hasError;
      }

      const serializeCache = JSON.stringify(this.metaInfo.serialize(), null, 3);
      const serializeStatus = JSON.stringify(status, null, 3);

      await Promise.all([
         fs.outputFile(pathUtils.join(this.config.output, 'status.json'), serializeStatus),
         logger.writeFile('status.json', serializeStatus),
         fs.outputFile(this.metaInfoPath, serializeCache),
         logger.writeFile('buildModules.json', serializeCache)
      ]);
   }

   async _readMetaBuild() {
      if (!fs.pathExistsSync(this.metaInfoPath) || !this.options.get('onlyChanges')) {
         this.metaInfo = new ModulesMap();

         return;
      }

      try {
         this.metaInfo = new ModulesMap(await fs.readJson(this.metaInfoPath));
      } catch (err) {
         logger.debug(`Error reading meta info prevision build. Error: ${err}`);
         logger.info('Can\'t read meta info about prevision build. Force rebuild all modules.');

         this.config.forceRebuild = true;
         this.metaInfo = new ModulesMap();
      }
   }

   /**
    * Копирует tslib.js и глобальные переменные в модуль WS.Core.
    * tslib.js используется в продакшене, поэтом приходится добавлять его в сборку.
    */
   async _tslibInstall() {
      logger.info('Installing tslib and global types in WS.Core');

      const wsCore = this.modules.get('WS.Core');

      // If there is no WS.Core in the project therefore nothing to install
      if (!wsCore) {
         return;
      }

      try {
         const tsPath = require.resolve('saby-typescript/cli/install.js');
         const wsTslib = pathUtils.join(wsCore.path, 'ext', 'tslib.js');
         const wsGlobalTyping = pathUtils.join(wsCore.path, 'global.d.ts');

         await this.cmd.execute(
            {
               file: tsPath,
               args: {
                  tsconfig: 'skip',
                  tslint: 'skip',
                  tslib: wsTslib,
                  globalTypings: wsGlobalTyping
               }
            },
            process.cwd(), {
               force: true,
               processName: 'typescriptInstall'
            }
         );
      } catch (e) {
         logger.error(`Error installing tslib and global types in WS.Core: ${e}`);
      }
   }

   injectLoadAfterModules(loadAfterModules) {
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
               this.config.modules.push(info.builderConfigModule);
               loadAfterModules.delete(name);
            }
         }

         if (loadAfterModulesSize === loadAfterModules.size) {
            throw new Error(`Modules "${[...loadAfterModules.keys()]}" has cycle dependencies in "load_after" construction.`);
         }

         loadAfterListIsEmpty = loadAfterModules.size === 0;
      }
   }

   /**
    * Формирует список модулей проекта в формате необходимом для конфигурации сборщика.
    */
   async _buildModulesListForConfig() {
      logger.info('Building modules for builder config');

      this.config.modules = [];
      const loadAfterModules = new Map();

      for (const module of this.modules.getModules()) {
         if (module.name === 'HotReload' && this.options.get('isLocaleProject') && !this.options.get('hotReload')) {
            continue;
         }

         const builderConfigModule = {
            id: module.id,
            name: module.name,
            path: module.path,
            required: module.required,
            featuresProvided: module.featuresProvided,
            featuresRequired: module.featuresRequired,
            depends: module.depends,
            service: ['intest-ps'],
            kaizen: module.kaizen
         };


         if (this.metaInfo.has(module.name)) {
            const previsionModule = this.metaInfo.get(module.name);
            const revisions = previsionModule.revision;

            if (revisions) {
               try {
                  const changedFiles = await module.getChangedFiles(revisions);

                  builderConfigModule.changedFiles = changedFiles.changed.map(filePath => filePath.replace(module.path, '.'));
                  builderConfigModule.deletedFiles = changedFiles.deleted.map(filePath => filePath.replace(module.path, '.'));
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
         }

         if (module.forCDN) {
            builderConfigModule.minimize = false;
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
            this.config.modules.push(builderConfigModule);
         }
      }

      this.injectLoadAfterModules(loadAfterModules);
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

      for (const module of this.modules.getModules()) {
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
}

module.exports = Builder;
