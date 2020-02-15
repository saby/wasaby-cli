const path = require('path');
const pMap = require('p-map');
const xml = require('../xml/xml');
const walkDir = require('./walkDir');

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
      this._testModulesMap = new Map();
      this._workDir = cfg.workDir;
      this._only = cfg.only;
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
            cfg.forTests && !result.includes(cfg.name) &&
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
            testList = testList.concat(this.getTestModules(name));
         });
      } else if (!this._testRep.includes('all')) {
         this._testRep.forEach((testRep) => {
            const modules = this.getParentModules(this.getTestModulesWithDepends(testRep));
            testList = testList.concat(this.getTestModules(testRep));
            modules.forEach((name) => {
               const cfg = this._modulesMap.get(name);
               this.getTestModules(cfg.rep).forEach((testModule) => {
                  if (!testList.includes(testModule)) {
                     testList.push(testModule);
                  }
               });
            });
         });
      } else {
         this._testModulesMap.forEach((modules) => {
            testList = testList.concat(modules);
         });
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
      const modules = this._testModulesMap.get(name) || [];
      modules.forEach((moduleName) => {
         const cfg = this._modulesMap.get(moduleName);
         result = result.concat(cfg.depends || []).filter(depend => (
            !!this._modulesMap.get(depend).forTests
         ));
         result.push(moduleName);
      });
      return result;
   }

   /**
    * Возвращает список модулей содержащих юнит тесты
    * @param {String} repName название репозитория
    * @return {Array}
    */
   getTestModules(repName) {
      return this._testModulesMap.get(repName) || [];
   }

   /**
    * Возвращает список модулей по репозиторию
    * @param {String} repName название репозитория
    * @return {Array}
    */
   getModulesByRep(repName) {
      const moduels = [];
      this._modulesMap.forEach((cfg) => {
         if (cfg.rep === repName) {
            moduels.push(cfg.name);
         }
      });
      return moduels;
   }

   /**
    * Запускает инициализацию modulesMap
    * @return {Promise<void>}
    */
   async build() {
      const modules = this._findModulesInStore();
      await this._addToModulesMap(modules);
      this._markModulesForTest();
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
                  const testModules = this._testModulesMap.get(cfg.rep) || [];
                  const repCfg = this._reposConfig[cfg.rep];
                  const onlyNode = xmlObj.ui_module.unit_test[0].$ && xmlObj.ui_module.unit_test[0].$.onlyNode;

                  testModules.push(cfg.name);

                  this._testModulesMap.set(cfg.rep, testModules);
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
    * Помечает модули используемые для тестов
    * @private
    */
   _markModulesForTest() {
      Object.keys(this._reposConfig).forEach((name) => {
         if (this._testModulesMap.has(name)) {
            const modules = this._testModulesMap.get(name);
            modules.forEach((testModuleName) => {
               const testModuleCfg = this._modulesMap.get(testModuleName);
               testModuleCfg.depends.forEach((moduleName) => {
                  const cfg = this._modulesMap.get(moduleName);
                  if (cfg && cfg.rep === name) {
                     cfg.forTests = true;
                     this._modulesMap.set(moduleName, cfg);
                  }
               });
               testModuleCfg.forTests = true;
               this._modulesMap.set(testModuleName, testModuleCfg);
            });
         }
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
}

module.exports = ModulesMap;
