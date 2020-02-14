const fs = require('fs-extra');
const path = require('path');
const logger = require('./util/logger');
const Base = require('./base');
const Git = require('./util/git');
const ModulesMap = require('./util/modulesMap');

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
         for (const rep of this._modulesMap.getTestRepos()) {
            promises.push(this.initRep(rep));
         }
         await Promise.all(promises);
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
}

module.exports = Store;
