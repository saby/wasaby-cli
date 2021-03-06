const path = require('path');
const pMap = require('p-map');
const xml = require('../xml/xml');
const walkDir = require('./walkDir');
const fs = require('fs-extra');

const MAP_FILE = path.normalize(path.join(__dirname, '..', '..', 'resources', 'modulesMap.json'));
const CDN_REP_NAME = 'wasaby_cdn';
const WSCoreDepends = ['Types', 'Env', 'View', 'Vdom', 'UI', 'Browser'];
const ownDependencies = ['Router', 'HotReload', 'DemoStand'];
/**
 * Карта модулей s3mod, из всех репозиториев
 * @class ModulesMap
 * @author Ганшин Я.О
 */
class ModulesMap {
   constructor(cfg) {
      this.options = cfg.options;
      this._entry = ModulesMap.prepareEntryPointModules(this.options.get('entry'));
      this._modulesMap = new Map();
      this._reBuildMap = cfg.reBuildMap;
      this._useOnlyCache = cfg.useOnlyCache;
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
    * Возвращает модули зависящие от модулей из переданного массива
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
            const depends = cfg.depends.concat(this.getChildModules(cfg.depends, defTraverse.concat([name])));

            result.push(name);
            depends.forEach((item) => {
               if (!result.includes(item)) {
                  result.push(item);
               }
            });
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

      if (this._entry.length > 0) {
         list = this.getChildModules(this.getEntryModules());
      } else if (this.options.get('only')) {
         this.options.get('rep').forEach((name) => {
            list = list.concat(this.getModulesByRep(name));
         });
      } else if (!this.options.get('rep').includes('all')) {
         this.options.get('rep').forEach((testRep) => {
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

      list = this.injectOwnDependencies(list);

      this._modulesList = list;
      return this._modulesList;
   }

   injectOwnDependencies(modules) {
      const result = new Set(modules);

      for (const dep of ownDependencies) {
         if (result.has(dep)) {
            continue;
         }

         for (const moduleName of this.getChildModules([dep])) {
            result.add(moduleName)
         }
      }

      return Array.from(result);
   }

   filterUnitTestModules(modules) {
      return modules.filter((moduleName) => {
         const module = this._modulesMap.get(moduleName);

         return module && module.unitTest;
      });
   }

   getUnitsTestModules(modules) {
      if (modules && modules.length !== 0) {
         const repos = new Set();
         let unitModules = [];

         for (const name of modules) {
            const module = this._modulesMap.get(name);

            if (module) {
               repos.add(module.rep);
            }
         }

         for (const reposName of repos) {
            unitModules = [...unitModules, ...this.getTestModulesByRep(reposName)]
         }

         return unitModules;
      }

      if (this.options.get('rep').includes('all')) {
         return this.getTestModulesByRep('all');
      }

      if (this._entry.length > 0) {
         return this.filterUnitTestModules(this.getParentModules(this.getEntryModules()));
      }

      const result = new Set();
      this.options.get('rep').forEach((testRep) => {
         for (const module of this.filterUnitTestModules(this.getParentModules(this.getModulesByRep(testRep)))) {
            result.add(module);
         }
      });

      return [...result];
   }

   //TODO Убрать когда возможность задать реализацию будет из корообки.
   injectReactModules(modules) {
      const result = [];

      for (const module of modules) {
         if (this.reactModules.has(module.name)) {
            result.push(this.reactModules.get(module.name));
         }

         result.push(module);
      }

      return result;
   }

   /**
    * Возвращает список модулей содержащих юнит тесты
    * @param {String} repName название репозитория
    * @return {Array}
    */
   getTestModulesByRep(repName) {
      return this.getModulesByRep(repName).filter(name => this.get(name).unitTest);
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
      const modules = this._useOnlyCache ? this._findModulesInStore(true) : this._findModulesInStore();

      if (this._reBuildMap) {
         await this._addToModulesMap(modules);
         await this._saveMap();
      } else {
         await this._addToModulesMap(modules);
         await this._loadMap();
      }
      this._addCyclicDependencies();
   }

   async getModuleMap() {
      return await fs.readJSON(path.join(MAP_FILE));
   }

   /**
    * Ищет модули в репозитории по s3mod
    * @return {Array}
    * @private
    */
   _findModulesInStore(onlyLocal) {
      const s3mods = [];
      const repositories = this.options.get('repositories');

      Object.keys(repositories).forEach((name) => {
         if (onlyLocal && !repositories[name].localeRep) {
            return;
         }

         let repositoryPath = this.getRepositoryPath(name);
         if (repositories[name].modulesPath) {
            repositoryPath = path.join(repositoryPath, repositories[name].modulesPath);
         }

         walkDir(repositoryPath, (filePath) => {
            if (filePath.includes('.s3mod')) {
               const splitFilePath = filePath.split(path.sep);
               splitFilePath.splice(-1, 1);
               const modulePath = path.join.apply(path, splitFilePath);
               const moduleName = splitFilePath[splitFilePath.length - 1];
               const absolutePath = path.join(repositoryPath, filePath);

               s3mods.push({
                  s3mod: absolutePath,
                  name: moduleName,
                  path: path.join(repositoryPath, modulePath),
                  rep: name,
                  useModuleMap: repositories[name].useMapOnly || false,
                  entry: this._entry.includes(absolutePath)
               });
            }
         },
            [
               path.join(repositoryPath, 'build-ui'),
               path.join(repositoryPath, 'node_modules'),
               this.options.get('resources')
            ]);
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
      let moduleMap = await this.getModuleMap();

      await pMap(modules, cfg => (
         xml.readXmlFile(cfg.s3mod).then((xmlObj) => {
            if (xmlObj.ui_module || cfg.entry) {
               if (cfg.useModuleMap && !moduleMap.hasOwnProperty(cfg.name)) {
                  return;
               }

               cfg.depends = [];

               if (cfg.useModuleMap) {
                  cfg.depends = moduleMap[cfg.name].depends;
               } else if (xmlObj.ui_module.depends && xmlObj.ui_module.depends[0]) {
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
                  const repCfg = this.options.get('repositories')[cfg.rep];
                  const onlyNode = xmlObj.ui_module.unit_test[0].$ && xmlObj.ui_module.unit_test[0].$.onlyNode;
                  cfg.unitTest = true;
                  cfg.testInBrowser = repCfg.unitInBrowser && !(onlyNode);
               }

               cfg.id = xmlObj.ui_module.$.id;
               cfg.required = !!xmlObj.ui_module.$.required;
               cfg.forCDN = xmlObj.ui_module.$.for_cdn === '1';

               // TODO Убрать когда возможность задать реализацию будет из корообки.
               if (xmlObj.ui_module.$.is_react === '1') {
                  if (this.options.get('react')) {
                     cfg.isReact = true;
                     this._modulesMap.set(cfg.name, cfg);
                  }
               } else if (!this._modulesMap.has(cfg.name)) {
                  this._modulesMap.set(cfg.name, cfg);
               }
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
      return this.options.get('repositories')[repName].path || path.join(this.options.get('store'), repName);
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
      let mapObject = await this.getModuleMap();
      for (let key of Object.keys(mapObject)) {
         if (!this._modulesMap.has(key)) {
            let mapObjectValue = mapObject[key];
            mapObjectValue.path = path.join(this.options.get('store'), mapObjectValue.path);
            mapObjectValue.s3mod = path.join(this.options.get('store'), mapObjectValue.s3mod);

            // TODO Убрать когда возможность задать реализацию будет из корообки.
            if (mapObjectValue.isReact === true) {
               if (this.options.get('react')) {
                  this._modulesMap.set(key, mapObjectValue);
               }
            } else {
               this._modulesMap.set(key, mapObjectValue);
            }
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
         mapObject = await this.getModuleMap();
      }

      this._modulesMap.forEach((value, key) => {
         mapObject[key] = {
            ...value,
            ...{
               path: path.relative(this.options.get('store'), value.path),
               s3mod: path.relative(this.options.get('store'), value.s3mod)
            }
         };
      });

      await fs.writeJSON(MAP_FILE, mapObject, {
         spaces: 2
      });
   }

   _addCyclicDependencies() {
      // TODO удалить как удалят WS.Core
      // У ws.core невозможно указать зависимости из-за циклической зависимостей.
      if (this.has('WS.Core')) {
         let cfg = this.get('WS.Core');
         cfg.depends = cfg.depends.concat(WSCoreDepends);
         this.set('WS.Core', cfg);
      }

      // TODO Удалить после закрытия задачи
      // Нельзя физичиски добавить в UI зависимость SbisEnvUI, из-за циклической зависиомтси побробности в диалоге.
      // https://online.sbis.ru/open_dialog.html?guid=960a2040-f9aa-49ec-a361-ff4120536ddd
      if (this.has('UI')) {
         let cfg = this.get('UI');
         cfg.depends.push('SbisEnvUI');
         cfg.depends.push('SbisEnvUI-default-theme');
         this.set('UI', cfg);
      }
   }

   /**
    * Возвращает модули для cdn
    * @returns {Array<String>}
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

   /**
    * Возвращает модули указанные в точке входа
    * @returns {Array<String>}
    */
   getEntryModules() {
      const result = [];
      this._modulesMap.forEach(cfg => {
         if (cfg.entry) {
            result.push(cfg.name);
         }
      });
      return result;
   }

   /**
    * Нормализует пути до модулей
    * @returns {Array<String>}
    * @private
    */
   static prepareEntryPointModules(entry) {
      if (entry) {
         return entry.map((pathToModule) => {
            let absolutePath = pathToModule;

            if (!path.isAbsolute(absolutePath)) {
               absolutePath = path.normalize(path.join(process.cwd(), pathToModule));
            }

            if (!fs.existsSync(absolutePath)) {
               throw new Error(`Не найден модуль ${absolutePath}, указанный в параметре entry, проверьте указанный путь.`);
            }

            return absolutePath;
         });
      }
      return [];
   }
}

module.exports = ModulesMap;
