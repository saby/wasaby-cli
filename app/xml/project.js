/* eslint-disable id-match */

const path = require('path');
const xml = require('./xml');
const fsUtil = require('../util/fs');
const fs = require('fs-extra');

function getUiModules(srv) {
   if (typeof srv.service.items[0] === 'object') {
      // eslint-disable-next-line id-match
      srv.service.items[0].ui_module = srv.service.items[0].ui_module || [];
   } else {
      srv.service.items[0] = { ui_module: [] };
   }

   return srv.service.items[0].ui_module;
}

function setUiModules(srv, modules) {
   srv.service.items[0].ui_module = modules;
}

/**
 * Класс для работы c файлом проекта .s3cld
 * @class Project
 * @author Ганшин Я.О.
 */
class Project {
   constructor(cfg) {
      this.options = cfg.options;
      this._modulesMap = cfg.modulesMap;
      this._modulesInSrv = [];
   }

   /**
    * Возвращает xml объект файла проекта
    * @returns {Promise<*>}
    * @private
    */
   async _getProject() {
      if (!this._project) {
         this._project = await xml.readXmlFile(this.options.get('projectPath'));
      }

      return this._project;
   }

   /**
    * Возвращает название проекта
    * @returns {Promise<string>}
    */
   async getName() {
      if (!this._name) {
         const project = await this._getProject();
         this._name = project.cloud.$.name;
      }
      return this._name;
   }

   /**
    * Возвращает путь до s3deploy файла
    * @returns {Promise<string>}
    */
   async getDeploy() {
      const projectDir = path.dirname(this.options.get('projectPath'));
      const name = await this.getName();
      return path.join(projectDir, `${name}.s3deploy`);
   }

   /**
    * Возвращает массив файлов описаний s3srv
    * @returns {Promise<string>}
    */
   async getServices() {
      if (!this._srv) {
         this._srv = [];
         const projectDir = path.dirname(this.options.get('projectPath'));
         const project = await this._getProject();
         project.cloud.items[0].service.forEach((obj) => {
            let url = obj.$.url;
            this._srv.push(path.resolve(projectDir, url));
         });
      }
      return this._srv;
   }

   /**
    * Заменяет пути до модулей в srv
    * @param {String} srvPath Путь до srv файла
    * @returns {Promise<void>}
    * @private
    */
   async _updateSrvModules(srvPath) {
      if (fs.existsSync(srvPath)) {
         const srv = await xml.readXmlFile(srvPath);
         const dirName = path.dirname(srvPath);
         const uiModules = getUiModules(srv);
         uiModules.forEach((item) => {
            if (this._modulesMap.has(item.$.name)) {
               const cfg = this._modulesMap.get(item.$.name);
               item.$.url = fsUtil.relative(dirName, cfg.s3mod);
               this._modulesInSrv.push(item.$.name);
            }
         });
         setUiModules(srv, uiModules);
         if (srv.service.parent) {
            await Promise.all(srv.service.parent.map(item => (
               this._updateSrvModules(path.normalize(path.join(dirName, item.$.path)))
            )));
         }
         xml.writeXmlFile(srvPath, srv);
      }
   }

   async _getModulesFromSrv(srvPath) {
      let modules = [];
      if (fs.existsSync(srvPath)) {
         const srv = await xml.readXmlFile(srvPath);
         const uiModules = getUiModules(srv);
         uiModules.forEach((item) => {
            modules.push(item.$.name);
         });
         const dirName = path.dirname(srvPath);
         if (srv.service.parent) {
            const parentModules = await Promise.all(srv.service.parent.map(item => (
               this._getModulesFromSrv(path.normalize(path.join(dirName, item.$.path)))
            )));
            modules = modules.concat(parentModules.reduce((acc, val) => acc.concat(val)));
         }
      }
      return modules;
   }

   /**
    * /**
    * Возвращает список модулей из проекта
    * @returns {Promise<any>}
    */
   async getProjectModules() {
      const srvPaths = await this.getServices();
      const servicesModules = await Promise.all(srvPaths.map(srv => this._getModulesFromSrv(srv)));
      return new Set(servicesModules.reduce((acc, val) => acc.concat(val)));
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

      business_logic[0].$.target_path = this.options.get('workDir');
      static_content[0].$.target_path = this.options.get('workDir');

      deploy.distribution_deploy_schema.$.json_cache = this.options.get('builderCache');

      if (process.platform === 'win32') {
         deploy.distribution_deploy_schema.$.compiler = 'clang';
         deploy.distribution_deploy_schema.$.architecture = 'i686';
         deploy.distribution_deploy_schema.$.os = 'windows';
      }

      await xml.writeXmlFile(filePath, deploy);
   }

   /**
    * Добавляет модули в srv
    * @param {String} srvPath путь до srv файла
    * @returns {Promise<void>}
    * @private
    */
   async _addModulesToSrv(srvPath) {
      const requiredModules = [...this._modulesInSrv, ...this._modulesMap.getRequiredModules()];
      if (requiredModules.length > 0) {
         const srv = await xml.readXmlFile(srvPath);
         const modules = getUiModules(srv);

         this._modulesMap.getChildModules(requiredModules).forEach((moduleName) => {
            if (!this._modulesInSrv.includes(moduleName)) {
               const cfg = this._modulesMap.get(moduleName);
               const dirName = path.dirname(srvPath);

               //TODO Удалить, довабил по ошибке https://online.sbis.ru/opendoc.html?guid=4c7b5d67-6afa-4222-b3cd-22b2e658b3a8
               if (cfg !== undefined) {
                  modules.push({
                     '$': {
                        'id': cfg.id,
                        'name': cfg.name,
                        'url': fsUtil.relative(dirName, cfg.s3mod)
                     }
                  });
               }
            }
         });

         xml.writeXmlFile(srvPath, srv);
      }
   }

   /**
    * Обновляет пути в файлайх конфигурации проекта
    * @returns {Promise<void>}
    */
   async prepare() {
      const srvPaths = await this.getServices();
      const deploy = await this.getDeploy();

      await Promise.all(srvPaths.map(srv => this._updateSrvModules(srv)));
      await this._addModulesToSrv(srvPaths[0]);
      await this._prepareDeployCfg(deploy);
   }
}

module.exports = Project;
