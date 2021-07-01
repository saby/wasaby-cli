const Shell = require('./shell');
const ERROR_MERGE_CODE = 101;
const logger = require('../util/logger');

const RC_BRANCH_LENGTH = 7;

/**
 * Ксласс содержащий методы работы с гитом
 * @class Git
 * @author Ганшин Я.О
 */
class Git {
   /**
    * Конструктор
    * @param {*} cfg
    */
   constructor(cfg) {
      this._path = cfg.path;
      this._shell = new Shell();
      this._name = cfg.name;
   }

   /**
    * Выполняет git fetch
    * @returns {Promise<any>}
    */
   fetch() {
      return this._shell.execute('git fetch --all --prune', this._path, {
         processName: `${this._name} git fetch`
      });
   }

   /**
    * Выполняет git merge --abort
    * @returns {Promise<any>}
    */
   mergeAbort() {
      return this._shell.execute('git merge --abort', this._path, {
         force: true,
         processName: `${this._name} git merge abort`
      });
   }

   /**
    * Выполняет git reset --hard revision
    * @param {String} revision  uuid комита или ветка
    * @returns {Promise<any>}
    */
   reset(revision) {
      logger.log(`git reset --hard ${revision}`);
      return this._shell.execute(`git reset --hard ${revision}`, this._path, {
         processName: `${this._name} git reset`
      });
   }

   /**
    * Выполняет git clean -fdx
    * @returns {Promise<any>}
    */
   clean() {
      return this._shell.execute('git clean -fdx', this._path, {
         processName: `${this._name} git clean`
      });
   }

   /**
    * Выполняет git checkout
    * @param {String} branch Ветка на которую надо переключится
    * @returns {Promise<any>}
    */
   checkout(branch) {
      return this._shell.execute(`git checkout -f ${branch}`, this._path, {
         processName: `${this._name} git checkout`
      });
   }


   /**
    * Функция пытаеться найти ближайщую rc ветку.
    * @param rc - rc ветка переданная пользователем.
    * @returns {Promise<String>}
    */
   async getNearestRcBranch(rc) {
      const allBranch = await this._getAllBranch();
      const majorRcVersion = rc.slice(0, rc.lastIndexOf('.') + 1);
      const mask = `origin/${rc.slice(0, rc.lastIndexOf('.') + 2)}`;
      const branchMask = [];

      for (const branch of allBranch) {
         if (branch.startsWith(mask)) {
            branchMask.push(branch);
         }
      }

      if (branchMask.includes(`origin/${rc}`)) {
         return rc;
      }

      const numberVersionRC = +rc.slice(rc.lastIndexOf('.') + 1);
      const numbersUpVersBranches = [];
      const numbersDownVersBranches = [];

      for (const branch of branchMask) {
         const numberVersionBranch = +branch.slice(branch.lastIndexOf('.') + 1);

         if (typeof numberVersionBranch === 'number') {
            if (numberVersionRC < numberVersionBranch) {
               numbersUpVersBranches.push(numberVersionBranch);
            }

            if (numberVersionRC > numberVersionBranch) {
               numbersDownVersBranches.push(numberVersionBranch);
            }
         }
      }

      if (numbersUpVersBranches.length === 0 && numbersDownVersBranches.length === 0) {
         return rc;
      }

      const minorRcVersion = this.getMinorVersionBranch(numbersUpVersBranches, numbersDownVersBranches);
      const detectedBranch = `${majorRcVersion}${minorRcVersion}`;

      if (!majorRcVersion || !minorRcVersion) {
         return rc;
      }

      return detectedBranch;
   }

   getMinorVersionBranch(upVersions, downVersions) {
      if (upVersions.length !== 0) {
         return upVersions.sort((current, next) => current - next).shift();
      }

      if (downVersions.length !== 0) {
         return downVersions.sort((current, next) => current -next).pop();
      }

      return '';
   }

   /**
    * Возрашает все ветки в репозитории.
    * @returns {Promise<string[]>}
    * @private
    */
   async _getAllBranch() {
      const result = await this._shell.execute('git branch -r', this._path, {
         silent: true,
         processName: `${this._name} git branch -r`,
         maxBuffer: 1024 * 1024 * 2
      });

      return result.join('').replace(/ /g, '').split('\n');
   }


   /**
    * Выполняет git merge
    * @param branch Ветка скоторой надо смержится
    * @returns {Promise<void>}
    */
   async merge(branch) {
      try {
         const mergeWith = Git.isBranch(branch) ? `remotes/origin/${branch}` : branch;
         await this._shell.execute(`git merge ${mergeWith}`, this._path, {
            processName: `${this._name} git merge`
         });
      } catch (e) {
         await this.mergeAbort();
         const error = new Error(`Конфликт при мерже '${branch}': ${e}`);
         error.code = ERROR_MERGE_CODE;
         throw error;
      }
   }

   /**
    * Выполняет git update
    * @returns {Promise<void>}
    */
   async update() {
      await this.fetch();
      await this.mergeAbort();
   }

   /**
    * Выполняет git diff возвращает результат
    * @param branch Ветка для которой нужен diff
    * @param rc Рц ветка
    * @returns {Promise<[]>}
    */
   async diff(branch, rc) {
      let res = await this._shell.execute(`git diff --name-only ${branch}..origin/${rc}`, this._path, {
         processName: `${this._name} git diff`
      });

      return res.join('\n').split('\n').filter(name => !!name);
   }

   /**
    * Возвращает текущую ветку репозитория
    * @returns {Promise<string>}
    */
   async getBranch() {
      let res = await this._shell.execute('git symbolic-ref --short HEAD', this._path, {
         processName: `${this._name} git branch`
      });

      return res.length > 0 ? res[0] : '';
   }

   /**
    * Определяет rc ветку из имени переданной ветки.
    * @param branch {String} Имя ветки из которой надо опредилть rc.
    * @returns {String}
    */
   static getRcBranch(branch) {
      const rc = branch.split('/')[0];

      if (rc.length === RC_BRANCH_LENGTH && rc.includes('.')) {
         return `rc-${rc}`
      }

      return undefined;
   }

   static isBranch(branch) {
      return branch.includes('/') || branch.includes('rc-');
   }
}

Git.ERROR_MERGE_CODE = ERROR_MERGE_CODE;
module.exports = Git;
