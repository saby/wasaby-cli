const fs = require('fs-extra');
const path = require('path');
const logger = require('./util/logger');
const Base = require('./base');
const Git = require('./util/git');
const Project = require('./xml/project');
const pMap = require('p-map');

const PARALLEL_CHECKOUT = 2;
/**
 * Класс отвечающий за установку зависимостей
 * @class Store
 * @author Ганшин Я.О.
 */

class Store extends Base {
   constructor(cfg) {
      cfg.useOnlyCache = true;
      super(cfg);
      this._store = cfg.store;
      this._argvOptions = cfg.argvOptions;
      this._config = cfg.config;
      this._rc = cfg.rc;
      this.cdnVersion = cfg.cdnVersion;
      this._testRep = cfg.testRep;
      this._projectPath = cfg.projectPath;
   }

   /**
    * Запускает инициализацию хранилища
    * @return {Promise<void>}
    */
   async _run() {
      logger.log('Инициализация хранилища');
      try {
         await fs.mkdirs(this._store);

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
      const cfg = this._config.repositories[name];

      // если есть путь до репозитория то его не надо выкачивать
      if (!cfg.skip && !cfg.path) {
         const branch = this.getCheckoutBranch(name, cfg);

         await this.cloneRepToStore(name);
         await this.checkout(
            name,
            branch
         );
      }
   }

   getCheckoutBranch(nameRepos, config) {
      if (nameRepos.endsWith('-cdn') || nameRepos.endsWith('_cdn')) {
         return this._argvOptions[nameRepos] || this.cdnVersion || config.version || this._rc;
      }

      return this._argvOptions[nameRepos] || config.version || this._rc;
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
      let [branch, mergeWith] = commit.split(':');
      const isBranch = Git.isBranch(branch);

      await git.update();

      if (isBranch) {
         if (branch.includes('rc-')) {
            branch = await git.getNearestRcBranch(branch);
            logger.log(`getNearestRcBranch return ${branch}`, name);
         }

         logger.log(`Переключение на ветку ${branch}`, name);

         try {
            await git.checkout(branch);
         } catch (err) {
            throw new Error(`Ошибка при переключение на ветку ${branch} в репозитории ${name}: ${err}`);
         }
      }

      await git.reset(isBranch ? `remotes/origin/${branch}` : branch);
      await git.clean();

      if (isBranch && !branch.includes('rc-')) {
         mergeWith = mergeWith || Git.getRcBranch(branch) || git.getVersion() || this._rc;

         logger.log(`Попытка смержить ветку '${branch}' с '${mergeWith}'`, name);

         await git.merge(mergeWith);
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
            logger.log(`git clone ${this._config.repositories[name].url}`, name);
            await this._shell.execute(`git clone ${this._config.repositories[name].url} ${name}`, this._store, {
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
      if (this._testRep.includes('all')) {
         return new Set(Object.keys(this._config.repositories));
      }
      const reposFromMap = this._modulesMap.getRequiredRepositories();
      const reposFromArgv = this._getReposFromArgv();
      const reposFromProject = await this._getProjectRepos();
      const reposFromConfig = this._getForceLoadRepos();
      return new Set([...reposFromMap, ...reposFromArgv, ...reposFromProject, ...reposFromConfig]);
   }

   /**
    * Возвращает репозитории переданные в аргуметах командной строки
    * @returns {Set<String>}
    * @private
    */
   _getReposFromArgv() {
      const repos = new Set();
      for (const name of Object.keys(this._config.repositories)) {
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

   /**
    * Возвращает репозитории помеченные для загрузки из конфига
    * @returns {Set<String>}
    * @private
    */
   _getForceLoadRepos() {
      const repos = new Set();
      for (const name of Object.keys(this._config.repositories)) {
         if (this._config.repositories[name].load) {
            repos.add(name);
         }
      }
      return repos;
   }
}

module.exports = Store;
