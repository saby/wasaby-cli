const path = require('path');
const pMap = require('p-map');
const xml = require('../xml/xml');
const walkDir = require('./walkDir');
const MAP_FILE_NAME = path.join('resources', 'modulesMap.json');
const fs = require('fs-extra');
const CDN_REP_NAME = 'cdn';
/**
 * Карта модулей s3mod, из всех репозиториев
 * @class ModulesMap
 * @author Ганшин Я.О
 */

class ModulesMap {
   constructor(cfg) {
      this._reposConfig = cfg.reposConfig;
      this._store = cfg.store;
      this._testRep = cfg.testRep;
      this._modulesMap = new Map();
      this._workDir = cfg.workDir;
      this._only = cfg.only;
      this._reBuildMap = cfg.reBuildMap;
   }

   /**
    * Возвращает конфиг модуля по имени
    * @param {String} name - Название модуля
    * @return {any}
    */
   get(name) {
      return this._modulesMap.get(name);
   }

   /**
    * Возвращает конфиг модуля по имени
    * @param {String} name - Название модуля
    * @param {any} value - Конфиг модуля
    */
   set(name, value) {
      this._modulesMap.set(name, value);
   }

   /**
    * Проверяет существование модуля
    * @param name - Название модуля
    * @return {boolean}
    */
   has(name) {
      return this._modulesMap.has(name);
   }

   /**
    * Перебирает модули из modulesMap
    * @param {function} callback
    */
   forEach(callback) {
      this._modulesMap.forEach(callback);
   }

   /**
    * Возвращает модули от которых зависят модули из переданного массива
    * @param {Array} modules - Массив с наваниями модулей
    * @return {Array}
    */
   getParentModules(modules) {
      let result = modules.slice();
      this._modulesMap.forEach((cfg) => {
         if (
            !result.includes(cfg.name) &&
            cfg.depends.some(dependName => result.includes(dependName))
         ) {
            result.push(cfg.name);
         }
      });
      if (modules.length !== result.length) {
         return this.getParentModules(result);
      }
      return result;
   }

   /**
    * Возращает все зависимости переданных модулей
    * @param {Array} modules - Массив с наваниями модулей
    * @param {Array} traverse - массив содеражащий текущий путь рекурсии
    * @return {Array}
    */
   getChildModules(modules, traverse) {
      const defTraverse = traverse || [];
      let result = [];
      modules.forEach((name) => {
         if (this._modulesMap.has(name) && !defTraverse.includes(name)) {
            const cfg = this._modulesMap.get(name);
            const depends = this.getChildModules(cfg.depends, defTraverse.concat([name]));
            result.push(name);
            result = result.concat(depends.filter(item => !result.includes(item)));
         }
      });
      return result;
   }

   /**
    * Возвращает список модулей для тестирования
    * @return {Array}
    */
   getTestList() {
      if (this._testList) {
         return this._testList;
      }
      let testList = [];
      if (this._only) {
         this._testRep.forEach((name) => {
            testList = testList.concat(this.getTestModulesByRep(name));
         });
      } else if (!this._testRep.includes('all')) {
         this._testRep.forEach((testRep) => {
            const modules = this.getParentModules(this.getTestModulesWithDepends(testRep));
            testList = testList.concat(this.getTestModulesByRep(testRep));
            modules.forEach((name) => {
               const cfg = this._modulesMap.get(name);
               this.getTestModulesByRep(cfg.rep).forEach((testModule) => {
                  if (!testList.includes(testModule)) {
                     testList.push(testModule);
                  }
               });
            });
         });
      } else {
         testList = this.getTestModulesByRep('all');
      }
      this._testList = testList;
      return this._testList;
   }

   /**
    * Возвращает список модулей содержащих юнит тесты и его зависимости
    * @return {Array}
    */
   getTestModulesWithDepends(name) {
      let result = [];
      const modules = this.getTestModulesByRep(name) || [];
      modules.forEach((moduleName) => {
         const cfg = this._modulesMap.get(moduleName);
         result = result.concat(cfg.depends || []);
         result.push(moduleName);
      });
      return result;
   }

   /**
    * Возвращает список модулей содержащих юнит тесты
    * @param {String} repName название репозитория
    * @return {Array}
    */
   getTestModulesByRep(repName) {
      let testModules = [];
      this._modulesMap.forEach((cfg) => {
         if (
            (cfg.rep === repName || repName === 'all') &&
            cfg.unitTest
         ) {
            testModules.push(cfg.name);
         }
      });
      return testModules;
   }

   /**
    * Запускает инициализацию modulesMap
    * @return {Promise<void>}
    */
   async build() {
      if (this._reBuildMap) {
         const modules = this._findModulesInStore();
         await this._addToModulesMap(modules);
         await this._saveMap();
      } else {
         await this._loadMap();
      }
   }

   /**
    * Ищет модули в репозитории по s3mod
    * @return {Array}
    * @private
    */
   _findModulesInStore() {
      const s3mods = [];
      Object.keys(this._reposConfig).forEach((name) => {
         const repositoryPath = this.getRepositoryPath(name);
         walkDir(repositoryPath, (filePath) => {
            if (filePath.includes('.s3mod')) {
               const splitFilePath = filePath.split(path.sep);
               splitFilePath.splice(-1, 1);
               const modulePath = path.join.apply(path, splitFilePath);
               const moduleName = splitFilePath[splitFilePath.length - 1];
               s3mods.push({
                  s3mod: path.join(repositoryPath, filePath),
                  name: moduleName,
                  path: path.join(repositoryPath, modulePath),
                  rep: name
               });
            }
         }, [path.join(process.cwd(), 'builder-ui'), path.join(process.cwd(), 'node_modules'), this._workDir]);
      });
      return s3mods;
   }

   /**
    * Добавляет модули в modulesMap
    * @param {Array} modules - массив с конфигами модулей
    * @return {Promise<void>}
    * @private
    */
   async _addToModulesMap(modules) {
      await pMap(modules, cfg => (
         xml.readXmlFile(cfg.s3mod).then((xmlObj) => {
            if (!this._modulesMap.has(cfg.name) && xmlObj.ui_module) {
               cfg.depends = [];

               if (xmlObj.ui_module.depends && xmlObj.ui_module.depends[0]) {
                  const depends = xmlObj.ui_module.depends[0];
                  if (depends.ui_module) {
                     depends.ui_module.forEach((item) => {
                        cfg.depends.push(item.$.name);
                     });
                  }
                  if (depends.module) {
                     depends.module.forEach((item) => {
                        cfg.depends.push(item.$.name);
                     });
                  }
               }

               if (xmlObj.ui_module.unit_test) {
                  const repCfg = this._reposConfig[cfg.rep];
                  const onlyNode = xmlObj.ui_module.unit_test[0].$ && xmlObj.ui_module.unit_test[0].$.onlyNode;
                  cfg.unitTest = true;
                  cfg.testInBrowser = repCfg.unitInBrowser && !(onlyNode);
               }

               this._modulesMap.set(cfg.name, cfg);
            }
         })
      ), {
         concurrency: 4
      });
   }

   /**
    * Возвращает путь до репозитория
    * @param {String} repName название репозитория
    * @return {string}
    */
   getRepositoryPath(repName) {
      return this._reposConfig[repName].path || path.join(this._store, repName);
   }

   /**
    * Возвращает список репозиториев
    * @returns {Set<String>}
    */
   getTestRepos() {
      const modules = this.getChildModules(this.getTestList());
      const repos = new Set([CDN_REP_NAME]);
      modules.forEach((module) => {
         const moduleCfg = this._modulesMap.get(module);
         repos.add(moduleCfg.rep);
      });
      return repos;
   }
   /**
    * Загружает карту модулей из файла
    * @returns {Promise<void>}
    * @private
    */
   async _loadMap() {
      let mapObject = await fs.readJSON(path.join(process.cwd(), MAP_FILE_NAME));
      for (let key of Object.keys(mapObject)) {
         let mapObjectValue = mapObject[key];
         mapObjectValue.path = path.join(this._store, mapObjectValue.path);
         mapObjectValue.s3mod = path.join(this._store, mapObjectValue.s3mod);
         this._modulesMap.set(key, mapObjectValue);
      }
   }

   /**
    * Сохраняет карту модулей в файл
    * @private
    */
   async _saveMap() {
      let mapObject = {};
      const mapPath = path.join(process.cwd(), MAP_FILE_NAME);

      if (fs.existsSync(mapPath)) {
         mapObject = await fs.readJSON(mapPath);
      }

      this._modulesMap.forEach((value, key) => {
         mapObject[key] = {...value, ...{
            path: path.relative(this._store, value.path),
            s3mod: path.relative(this._store, value.s3mod)
         }};
      });

      await fs.writeJSON(mapPath, mapObject);
   }
}

module.exports = ModulesMap;
