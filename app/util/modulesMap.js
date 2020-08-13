const path = require('path');
const pMap = require('p-map');
const xml = require('../xml/xml');
const walkDir = require('./walkDir');
const fs = require('fs-extra');

const MAP_FILE = path.normalize(path.join(__dirname, '..', '..', 'resources', 'modulesMap.json'));
const CDN_REP_NAME = 'cdn';
const WSCoreDepends = ['Types', 'Env', 'View', 'Vdom', 'UI'];
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
      this._resources = cfg.resources;
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
    * @param {Array} traverse - Массив содеражащий текущий путь рекурсии
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
    * Возвращает список необходимых модулей
    * @return {Array}
    */
   getRequiredModules() {
      if (this._modulesList) {
         return this._modulesList;
      }
      let list = [];
      if (this._only) {
         this._testRep.forEach((name) => {
            list = list.concat(this.getModulesByRep(name));
         });
      } else if (!this._testRep.includes('all')) {
         this._testRep.forEach((testRep) => {
            const modules = this.getParentModules(this.getModulesByRep(testRep));
            const requiredModules = this.getTestModulesByRep(testRep);
            list = list.concat(requiredModules.length > 0 ? requiredModules : this.getModulesByRep(testRep));
            modules.forEach((name) => {
               const cfg = this._modulesMap.get(name);
               if (cfg) {
                  this.getTestModulesByRep(cfg.rep).forEach((testModule) => {
                     if (!list.includes(testModule)) {
                        list.push(testModule);
                     }
                  });
               }
            });
         });
      } else {
         list = this.getTestModulesByRep('all');
      }
      this._modulesList = list;
      return this._modulesList;
   }

   /**
    * Возвращает список модулей содержащих юнит тесты
    * @param {String} repName название репозитория
    * @return {Array}
    */
   getTestModulesByRep(repName) {
      return  this.getModulesByRep(repName).filter((name) => this.get(name).unitTest);
   }

   /**
    * Возвращает список модулей из репозитория
    * @param {String} repName название репозитория
    * @return {Array}
    */
   getModulesByRep(repName) {
      let modules = [];
      this._modulesMap.forEach((cfg) => {
         if ((cfg.rep === repName || repName === 'all')) {
            modules.push(cfg.name);
         }
      });
      return modules;
   }

   /**
    * Запускает инициализацию modulesMap
    * @return {Promise<void>}
    */
   async build() {
      const modules = this._findModulesInStore();
      if (this._reBuildMap) {
         await this._addToModulesMap(modules);
         await this._saveMap();
      } else {
         await this._addToModulesMap(modules);
         await this._loadMap();
      }
      this._addWsCoreDepends()
   }

   /**
    * Ищет модули в репозитории по s3mod
    * @return {Array}
    * @private
    */
   _findModulesInStore() {
      const s3mods = [];
      Object.keys(this._reposConfig).forEach((name) => {
         let repositoryPath = this.getRepositoryPath(name);
         if (this._reposConfig[name].modulesPath) {
            repositoryPath = path.join(repositoryPath, this._reposConfig[name].modulesPath);
         }

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
         }, [path.join(repositoryPath, 'build-ui'), path.join(repositoryPath, 'node_modules'), this._resources]);
      });
      return s3mods;
   }

   /**
    * Добавляет модули в modulesMap
    * @param {Array} modules - Массив с конфигами модулей
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

               cfg.id = xmlObj.ui_module.$.id;
               cfg.required = !!xmlObj.ui_module.$.required
               cfg.forCDN = xmlObj.ui_module.$.for_cdn === "1";
               this._modulesMap.set(cfg.name, cfg);
            }
         })
      ), {
         concurrency: 4
      });
   }

   /**
    * Возвращает путь до репозитория
    * @param {String} repName Название репозитория
    * @return {string}
    */
   getRepositoryPath(repName) {
      return this._reposConfig[repName].path || path.join(this._store, repName);
   }

   /**
    * Возвращает список репозиториев
    * @returns {Set<String>}
    */
   getRequiredRepositories() {
      const modules = this.getChildModules(this.getRequiredModules());
      const repos = new Set([CDN_REP_NAME]);
      modules.forEach((module) => {
         const moduleCfg = this._modulesMap.get(module);
         if (moduleCfg) {
            repos.add(moduleCfg.rep);
         }
      });
      return repos;
   }

   /**
    * Загружает карту модулей из файла
    * @returns {Promise<void>}
    * @private
    */
   async _loadMap() {
      let mapObject = await fs.readJSON(path.join(MAP_FILE));
      for (let key of Object.keys(mapObject)) {
         if (!this._modulesMap.has(key)) {
            let mapObjectValue = mapObject[key];
            mapObjectValue.path = path.join(this._store, mapObjectValue.path);
            mapObjectValue.s3mod = path.join(this._store, mapObjectValue.s3mod);
            this._modulesMap.set(key, mapObjectValue);
         }
      }
   }

   /**
    * Сохраняет карту модулей в файл
    * @private
    */
   async _saveMap() {
      let mapObject = {};

      if (fs.existsSync(MAP_FILE)) {
         mapObject = await fs.readJSON(MAP_FILE);
      }

      this._modulesMap.forEach((value, key) => {
         mapObject[key] = {
            ...value,
            ...{
               path: path.relative(this._store, value.path),
               s3mod: path.relative(this._store, value.s3mod)
            }
         };
      });

      await fs.writeJSON(MAP_FILE, mapObject);
   }

   _addWsCoreDepends() {
      //У ws.core невозможно указать зависимости, удалить как удалят ws.core
      if (this.has('WS.Core')) {
         let cfg = this.get('WS.Core');
         cfg.depends = WSCoreDepends;
         this.set('WS.Core', cfg);
      }
   }

   /**
    * Возвращает модули для cdn
    */
   getCDNModules() {
      let modules = [];
      this._modulesMap.forEach((cfg) => {
         if (cfg.forCDN) {
            modules.push(cfg.name);
         }
      });
      return modules;
   }
}

module.exports = ModulesMap;
