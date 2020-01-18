const fs = require('fs-extra');
const path = require('path');
const logger = require('./util/logger');
const Base = require('./base');
const Git = require('./util/git');

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
   }

   /**
    *
    * @return {Promise<void>}
    */
   async _run() {
      logger.log('Инициализация хранилища');
      try {
         await fs.mkdirs(this._store);
         await Promise.all(Object.keys(this._reposConfig).map(name => (
            this.initRep(name).catch((error) => {
               if (error.code === Git.ERROR_MERGE_CODE) {
                  logger.log(`Удаление репозитория ${name}`);
                  fs.removeSync(path.join(this._store, name));
                  logger.log(`Повторное клонирование ${name}`);
                  return this.initRep(name);
               }
               throw error;
            })
         )));
         logger.log('Инициализация хранилища завершена успешно');
      } catch (e) {
         throw new Error(`Инициализация хранилища завершена с ошибкой ${e}`);
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
            if (/rc-.*00/.test(commit)) {
               // для некоторых репозиториев нет ветки yy.v00 только yy.v10 (19.610) в случае
               // ошибки переключаемся на 10 версию
               let replacedCommit = commit.replace('00', '10');
               await git.checkout(replacedCommit.replace('00', '10'));
            } else {
               throw new Error(`Ошибка при переключение на ветку ${commit} в репозитории ${this._name}: ${err}`);
            }
         }
      }
      await git.reset(isBranch ? `remotes/origin/${commit}` : commit);
      await git.clean();

      if (isBranch && this._testRep.includes(name)) {
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
