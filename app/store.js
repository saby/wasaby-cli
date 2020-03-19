const fs = require('fs-extra');
const path = require('path');
const logger = require('./util/logger');
const Base = require('./base');
const Git = require('./util/git');
const ModulesMap = require('./util/modulesMap');
const Project = require('./xml/project');
const pMap = require('p-map');

const PARALLEL_CHECKOUT = 2;
/**
 * Класс отвечающий за подготовку репозиториев для тестирования
 * @class Store
 * @author Ганшин Я.О
 */

class Store extends Base {
   constructor(cfg) {
      super(cfg);
      this._store = cfg.store;
      this._argvOptions = cfg.argvOptions;
      this._reposConfig = cfg.reposConfig;
      this._rc = cfg.rc;
      this._testRep = cfg.testRep;
      this._projectPath = cfg.projectPath;
      this._only = cfg.only;
      this._modulesMap = new ModulesMap({
         reposConfig: this._reposConfig,
         store: cfg.store,
         testRep: cfg.testRep,
         workDir: this._workDir,
         only: cfg.only
      });
   }

   /**
    * Запускает инициализацию хранилища
    * @return {Promise<void>}
    */
   async _run() {
      logger.log('Инициализация хранилища');
      try {
         await this._modulesMap.build();
         await fs.mkdirs(this._store);
         const promises = [];

         await pMap(await this._getReposList(), (rep) => {
            return this.initRep(rep);
         }, {
            concurrency: PARALLEL_CHECKOUT
         });
         logger.log('Инициализация хранилища завершена успешно');
      } catch (e) {
         e.message = `Инициализация хранилища завершена с ошибкой ${e.message}`;
         throw e;
      }
   }

   /**
    * Инициализация хранилища, клонирует/копирует репозитории переключает на нужные ветки
    * @param {String} name - название репозитория в конфиге
    * @return {Promise<void>}
    */
   async initRep(name) {
      const cfg = this._reposConfig[name];

      // если есть путь до репозитория то его не надо выкачивать
      if (!cfg.skip && !cfg.path) {
         const branch = this._argvOptions[name] || this._rc;
         await this.cloneRepToStore(name);
         await this.checkout(
            name,
            branch
         );
      }
   }

   /**
    * переключает репозиторий на нужную ветку
    * @param {String} name - название репозитория в конфиге
    * @param {String} commit - ветка или хеш комита на который нужно переключиться
    * @return {Promise<void>}
    */
   async checkout(name, commit) {
      if (!commit) {
         throw new Error(`Не удалось определить ветку для репозитория ${name}`);
      }

      const git = new Git({
         path: path.join(this._store, name),
         name: name
      });
      const isBranch = commit.includes('/') || commit.includes('rc-');

      logger.log(`Переключение на ветку ${commit}`, name);
      await git.update();
      if (isBranch) {
         try {
            await git.checkout(commit);
         } catch (err) {
            throw new Error(`Ошибка при переключение на ветку ${commit} в репозитории ${this._name}: ${err}`);
         }
      }
      await git.reset(isBranch ? `remotes/origin/${commit}` : commit);
      await git.clean();

      if (isBranch && !commit.includes('rc-')) {
         logger.log(`Попытка смержить ветку '${commit}' с '${this._rc}'`, name);
         await git.merge(this._rc);
      }
   }

   /**
    * Клонирует репозиторий из гита
    * @param {String} name - название репозитория в конфиге
    * @return {Promise<*|string>}
    */
   async cloneRepToStore(name) {
      if (!fs.existsSync(path.join(this._store, name))) {
         try {
            logger.log(`git clone ${this._reposConfig[name].url}`, name);
            await this._shell.execute(`git clone ${this._reposConfig[name].url} ${name}`, this._store, {
               processName: `clone ${name}`
            });
         } catch (err) {
            throw new Error(`Ошибка при клонировании репозитория ${name}: ${err}`);
         }
      }
   }

   /**
    * Возвращает список репозиториев которые надо обновить
    * @returns {Set<String>}
    * @private
    */
   async _getReposList() {
      if (this._only) {
         const reposFromMap = this._modulesMap.getTestRepos();
         const reposFromArgv = this._getReposFromArgv();
         const reposFromProject = await this._getProjectRepos();
         return new Set([... reposFromMap, ... reposFromArgv, ... reposFromProject]);
      } else {
         return new Set(Object.keys(this._reposConfig));
      }
   }

   /**
    * Возвращает репозитории переданные в аргуметах командной строки
    * @returns {Set<String>}
    * @private
    */
   _getReposFromArgv() {
      const repos = new Set();
      for (const name of Object.keys(this._reposConfig)) {
         if (this._argvOptions.hasOwnProperty(name)) {
            repos.add(name);
         }
      }
      return repos;
   }

   /**
    *
    * @returns {Set<String>}
    * @private
    */
   async _getProjectRepos() {
      const repos = new Set();
      if (this._projectPath) {
         const project = new Project({
            file: this._projectPath
         });
         const modules = await project.getProjectModules();
         modules.forEach(name => {
            if (this._modulesMap.has(name)) {
               const cfg = this._modulesMap.get(name);
               repos.add(cfg.rep);
            }
         });
      }
      return repos;
   }
}

module.exports = Store;
