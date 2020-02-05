const fs = require('fs-extra');
const path = require('path');
const logger = require('./util/logger');
const xml = require('./xml/xml');
const ModulesMap = require('./util/modulesMap');
const Base = require('./base');
const Sdk = require('./util/sdk');
const Project = require('./xml/project');
const fsUtil = require('./util/fs');
const builderConfigName = 'builderConfig.json';
const builderBaseConfig = '../builderConfig.base.json';

/**
 * Класс отвечающий за сборку ресурсов для тестов
 * @author Ганшин Я.О
 */

class Build extends Base {
   constructor(cfg) {
      super(cfg);
      this._store = cfg.store;
      this._rc = cfg.rc;
      this._reposConfig = cfg.reposConfig;
      this._buildTools = cfg.buildTools;
      this._resources = cfg.resources;
      this._workDir = cfg.workDir;
      this._builderCache = cfg.builderCache;
      this._workspace = cfg.workspace;
      this._projectPath = cfg.projectPath;
      this._pathToJinnee = cfg.pathToJinnee;
      this._builderCfg = path.join(process.cwd(), 'builderConfig.json');
      this._modulesMap = new ModulesMap({
         reposConfig: this._reposConfig,
         store: cfg.store,
         testRep: cfg.testRep,
         workDir: this._workDir,
         only: cfg.only
      });
      if (cfg.builderBaseConfig) {
         this._builderBaseConfig = path.normalize(path.join(process.cwd(), cfg.builderBaseConfig));
      } else {
         this._builderBaseConfig = builderBaseConfig;
      }
   }

   /**
    * Запускает сборку стенда
    * @return {Promise<void>}
    */
   async _run() {
      try {
         logger.log('Подготовка тестов');
         await this._modulesMap.build();
         await this._tslibInstall();
         if (this._buildTools === 'builder') {
            await this._initWithBuilder();
         } else {
            await this._initWithJinnee();
         }
         await this._linkFolder();
         logger.log('Подготовка тестов завершена успешно');
      } catch (e) {
         throw new Error(`Сборка ресурсов завершена с ошибкой: ${e}`);
      }
   }

   /**
    * Сборка ресурсов через билдер
    * @param {String} builderOutput Папка в которую складыватся результат работы билдера
    * @returns {Promise<void>}
    * @private
    */
   async _initWithBuilder(builderOutput) {
      await this._makeBuilderConfig(builderOutput);
      await this._shell.execute(
         `node node_modules/gulp/bin/gulp.js --gulpfile=node_modules/sbis3-builder/gulpfile.js build --config=${this._builderCfg}`,
         process.cwd(), {
            force: true,
            name: 'builder'
         }
      );
   }

   /**
    * Заменяет пути в srv
    * @param {String} srvPath Путь до srv файла
    * @returns {Promise<void>}
    * @private
    */
   async _prepareSrv(srvPath) {
      if (fs.existsSync(srvPath)) {
         const srv = await xml.readXmlFile(srvPath);
         const dirName = path.dirname(srvPath);
         const uiModules = srv.service.items[0].ui_module || [];
         uiModules.forEach((item) => {
            if (this._modulesMap.has(item.$.name)) {
               const cfg = this._modulesMap.get(item.$.name);
               item.$.url = fsUtil.relative(dirName, cfg.s3mod);
               cfg.srv = true;
               this._modulesMap.set(cfg.name, cfg);
            }
         });
         if (srv.service.parent) {
            await Promise.all(srv.service.parent.map(item => (
               this._prepareSrv(path.normalize(path.join(dirName, item.$.path)))
            )));
         }
         xml.writeXmlFile(srvPath, srv);
      }
   }

   /**
    * Заменяет константы в .deploy
    * @param {String} filePath Путь до .deploy файлаы
    * @private
    */
   async _prepareDeployCfg(filePath) {
      let deploy = await xml.readXmlFile(filePath);
      const business_logic = deploy.distribution_deploy_schema.site[0].business_logic;
      const static_content = deploy.distribution_deploy_schema.site[0].static_content;

      business_logic[0].$.target_path = this._workDir;
      static_content[0].$.target_path = this._workDir;

      deploy.distribution_deploy_schema.$.json_cache = this._builderCache;

      if (process.platform === 'win32') {
         deploy.distribution_deploy_schema.$.compiler = 'clang';
         deploy.distribution_deploy_schema.$.architecture = 'i686';
         deploy.distribution_deploy_schema.$.os = 'windows';
      }

      await xml.writeXmlFile(filePath, deploy);
   }

   /**
    * Запускает сборку джином
    * @returns {Promise<void>}
    * @private
    */
   async _initWithJinnee() {
      const logs = path.join(this._workDir, 'logs');
      const sdk = new Sdk({
         rc: this._rc,
         workspace: this._workspace,
         pathToJinnee: this._pathToJinnee
      });
      const project = new Project({
         file:  this._projectPath
      });
      const srvPaths = await project.getServices();
      const deploy = await project.getDeploy();

      await Promise.all(srvPaths.map((srv) => this._prepareSrv(srv)));
      await this._prepareDeployCfg(deploy);

      await sdk.jinneeDeploy(deploy, logs, project.file);
      const testList = this._modulesMap.getTestList();

      if (testList.length > 0) {
         const builderOutput = path.join(this._workDir, 'builder_test');
         await this._initWithBuilder(builderOutput);
         fs.readdirSync(builderOutput).forEach((f) => {
            let dirPath = path.join(builderOutput, f);
            if (fs.statSync(dirPath).isDirectory()) {
               fs.ensureSymlink(dirPath, path.join(this._resources, f));
            }
         });
      }
   }

   /**
    * Копирует tslib
    * @private
    */
   _tslibInstall() {
      const tslib = fsUtil.relative(process.cwd(), path.join(this._modulesMap.getRepositoryPath('sbis3-ws'), '/WS.Core/ext/tslib.js'));
      logger.log(tslib, 'tslib_path');
      return this._shell.execute(
         `node node_modules/saby-typescript/cli/install.js --tslib=${tslib}`,
         process.cwd(), {
            force: true,
            name: 'typescriptInstall'
         }
      );
   }

   /**
    * Создает симлинки в рабочей директории, после прогона билдера
    * @return {Promise<void>}
    * @private
    */
   _linkFolder() {
      const promises = [];
      for (const name of Object.keys(this._reposConfig)) {
         if (this._reposConfig[name].linkFolders) {
            for (const pathOriginal of Object.keys(this._reposConfig[name].linkFolders)) {
               const pathDir = path.join(this._store, name, pathOriginal);
               const pathLink = path.join(this._resources, this._reposConfig[name].linkFolders[pathOriginal]);
               promises.push(fs.ensureSymlink(pathDir, pathLink));
            }
         }
      }
      return Promise.all(promises);
   }

   /**
    * Создает конфиг для билдера
    * @return {Promise<void>}
    * @private
    */
   _makeBuilderConfig(output) {
      const builderConfig = require(this._builderBaseConfig);
      const testList = this._modulesMap.getTestList();

      this._modulesMap.getChildModules(testList).forEach((moduleName) => {
         const cfg = this._modulesMap.get(moduleName);
         if (moduleName !== 'unit' && !cfg.srv) {
            const isNameInConfig = builderConfig.modules.find(item => (item.name === moduleName));
            if (!isNameInConfig) {
               builderConfig.modules.push({
                  name: moduleName,
                  path: cfg.path
               });
            }
         }
      });

      builderConfig.output = output || this._resources;
      return fs.outputFile(`./${builderConfigName}`, JSON.stringify(builderConfig, null, 4));
   }
}

module.exports = Build;
