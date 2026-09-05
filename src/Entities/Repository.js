const fs = require('fs-extra');

const logger = require('../Utils/Logger');
const tensorFlow = require('../Utils/tensorFlow');
const Git = require('../Utils/Git');
const pathUtils = require('../Utils/path');
const ChildProcess = require('../Process/ChildProcess');

const TMP_BRANCH = 'tmpl_branch_wasaby-cli';

/**
 * Класс сущности репозиторий.
 * @class Repository
 * @author Кудрявцев И.С.
 */
class Repository extends Git {
   /**
    * @param cfg.url {String} URL удаленного репозитория.
    * @param cfg.dir {String} Директория, содержащая репозиторий.
    * @param [cfg.name] {String} Имя папки локального репозитория.
    * @param [cfg.path] {String} Путь до локального репозитория.
    * @param [cfg.HEAD] {String} Ревизия на которую переключён репозиторий.
    * @param [cfg.requiredBranch] {String} Имя ветки или хеш коммита, на который необходимо переключиться.
    * @param [cfg.requireLoading] {Boolean} Загрузить репозиторий безусловно.
    * @param [cfg.loadHistory] {Boolean} Грузить ли git историю.
    * @param [cfg.initialized] {Boolean} Индикатор, что репозиторий уже инициализирован.
    * @param [cfg.mergeTarget] {String} С какой веткой или ревизией необходимо промержить ветку.
    */
   constructor(cfg) {
      super(cfg);

      this.HEAD = cfg.HEAD;
      this.requiredBranch = cfg.requiredBranch;
      this.loadHistory = typeof cfg.loadHistory === 'undefined' ? true : cfg.loadHistory;
      this.mergeTarget = cfg.mergeTarget;

      this.requireLoading = !!cfg.requireLoading;

      this.initialized = !!cfg.initialized;

      // TODO в репозитории Ядра созданы модули, которые используются в их юнит тестах.
      //  Названия этих модулей может пересекаться с реальными и они имеют зависимости на реальные модули.
      //  Приходиться задавать конкретную папку где искать модули, чтобы исключить попадания в карту тестовых.
      this.modulesDir = this.name === 'sbis_core' ? pathUtils.join(this.path, 'client') : this.path;

      this.changedFiles = new Map();
   }

   async install(preClean) {
      if (this.initialized) {
         return;
      }

      let existed = false;

      try {
         if (!fs.pathExistsSync(this.path)) {
            await this.init();
         } else {
            existed = true;

            if (preClean) {
               await this.clearAll();
            }
         }

         if (Git.isCommitSHA(this.requiredBranch)) {
            await this.installCommitSHA(this.requiredBranch);
         } else if (this.loadHistory && tensorFlow.isUserBranch(this.requiredBranch)) {
            await this.installUserBranch(this.requiredBranch);
         } else {
            await this.installBranch(this.requiredBranch);
         }
      } catch (err) {
         if (existed && err.gitType !== 'mergeConflict') {
            logger.debug(`Repository ${this.name} will reinstalled for error ${err}.`);

            await this.delete();
            await this.install();

            return this;
         }

         await this.deleteBranch(TMP_BRANCH);

         throw new Error(`Couldn't install repository ${this.url}. Error: ${err.stack}`);
      }

      logger.info(`Repository ${this.name} installed on ${this.requiredBranch}`);

      this.initialized = true;
      this.freezeStateOfCommits = true;
      this.HEAD = await this.revParse();

      return this;
   }

   /**
    * Реализовывает стратегию скачивания, обновления git ревизии.
    * @param revision - Ревизия коммита в SHA-1 формате.
    * @returns {Promise<void>}
    */
   async installCommitSHA(revision) {
      await this.fetchRevision(revision);
      await this.checkout(revision);
   }

   /**
    * Реализовывает стратегию скачивания, обновления git ветки.
    * @param branch - Имя git-ветки.
    * @returns {Promise<void>}
    */
   async installBranch(branch) {
      await this.checkoutTmpBranch();

      await this.fetchBranch(branch);
      await this.checkout(branch);

      await this.deleteBranch(TMP_BRANCH);
   }

   /**
    * Реализовывает стратегию скачивания, обновления ветки разработчика.
    * @param branch - имя ветки разработчика по TensorFlow.
    * @returns {Promise<void>}
    */
   async installUserBranch(branch) {
      const rcBranch = this.mergeTarget || tensorFlow.getRcBranch(this.requiredBranch);

      await this.checkoutTmpBranch();

      await this.fetchBranch(branch);

      if (Git.isCommitSHA(rcBranch)) {
         await this.fetchRevision(rcBranch);
      } else {
         await this.fetchBranch(rcBranch);
      }

      await this.checkout(branch);

      await this.merge(rcBranch);

      await this.deleteBranch(TMP_BRANCH);
   }

   async checkoutTmpBranch() {
      try {
         await this.showRef(TMP_BRANCH, {
            quiet: true
         });
         await this.checkout(TMP_BRANCH);
      } catch (_err) {
         await this.checkout(TMP_BRANCH, {
            b: true
         });
      }
   }

   async fetchRevision(revision) {
      try {
         // Проверяем есть ли ревизия локально.
         await this.catFile(revision, {
            e: true
         });
      } catch (_err) {
         if (this.loadHistory) {
            await this.fetch({
               all: true,
               prune: true
            });
         } else {
            await this.fetch({
               depth: 1,
            }, [
               'origin',
               revision
            ]);
         }
      }
   }

   async fetchBranch(branch) {
      const localRevision = await this.getLocalRevision(branch);
      const originRevision = await this.getRemoteRevision(branch);

      if (localRevision && originRevision && (localRevision === originRevision)) {
         return;
      }

      await this.deleteBranch(branch);

      if (this.loadHistory) {
         await this.fetch({
            all: true,
            prune: true,
         });
      } else {
         await this.fetch({
            depth: 1,
            prune: true,
         }, [
            'origin',
            `+refs/heads/${branch}:refs/remotes/origin/${branch}`
         ]);
      }
   }

   async deleteBranch(branch) {
      try {
         await this.branch(branch, {
            D: true
         });
      } catch (err) {
         // Если упало удаление ветки, то скорее всего её просто нет.
         logger.debug(err);
      }
   }

   async getCurrentRCBranch() {
      const branch = await this.branch('', {
         'show-current': true
      });

      if (branch[0]) {
         return tensorFlow.getRcBranch(branch[0]);
      }
   }

   async clearAll() {
      await this.reset({
         hard: true
      });
      await this.clean({
         force: true,
         d: true,
         x: true
      });
   }

   _sortDiffFiles(files) {
      const result = {
         changed: [],
         deleted: []
      };

      for (const file of files) {
         const [status, oldPath, newPath] = file.split('\t');

         if (status.includes('R')) {
            result.deleted.push(pathUtils.join(this.path, oldPath));
            result.changed.push(pathUtils.join(this.path, newPath));

            continue;
         }

         if (status.includes('D')) {
            result.deleted.push(pathUtils.join(this.path, oldPath));

            continue;
         }

         result.changed.push(pathUtils.join(this.path, oldPath));
      }

      return result;
   }

   async getNotCommittedFiles() {
      const files = await this.diff(
         '',
         'HEAD',
         {
            cached: true,
            'name-status': true
         },
         true
      );

      return this._sortDiffFiles(files);
   }

   /**
    * Получить список измененных файлов.
    *
    * @param lastRevision {string} Прошлая ревизия репозитория.
    * @returns {Promise<Object>}
    */
   async getChangedFiles(lastRevision) {
      if (this.changedFiles.has(lastRevision)) {
         return this.changedFiles.get(lastRevision);
      }

      const files = await this.diff(
         `"${lastRevision}"`,
         'HEAD',
         {
            'name-status': true
         }
      );
      const result = this._sortDiffFiles(files);

      logger.debug(
         `Changed files for repository "${this.name}" and commit "${lastRevision}":${JSON.stringify(result, null, 3)}`
      );

      this.changedFiles.set(lastRevision, result);

      return result;
   }

   async getLocalRevision(branch) {
      try {
         return await this.revParse(branch);
      } catch (err) {
         // Если упало получение ревизии, значит локально ветки нет вернём undefined.
         return undefined;
      }
   }

   async getRemoteRevision(branch) {
      let trying = 4;

      // Почему-то ls-remote может в рандомный момент отдать ничего. Поэтому попытаемся получить 4 раза.
      for (trying; trying > 0; --trying) {
         const rawData = await this.lsRemote(branch);

         if (rawData && rawData[0]) {
            return rawData[0].split('\t')[0];
         }
      }
   }

   async getRemoteBranches(mask) {
      const branches = await this.lsRemote(mask, {
         heads: true,
         quiet: true
      });
      const result = [];

      for (const branch of branches) {
         result.push((branch.split('\t')[1]).replace('refs/heads/', ''));
      }

      return result;
   }

   async setHookPath(path) {
      await this.config('core.hooksPath', 'set', `"${path}"`);
   }

   /**
    * Получить сериализуемую часть инстанса.
    * @returns {Object} Сериализуемое содержимое инстанса.
    */
   serialize() {
      return {
         ...super.serialize(),
         type: 'Repository',
         url: this.url,
         initialized: this.initialized,
         HEAD: this.HEAD,
         loadHistory: this.loadHistory,
         protocol: this.protocol,
      };
   }

   static async checkSSH() {
      const chldProcess = new ChildProcess({
         commandLine: 'ssh -oBatchMode=yes -T git@git.sbis.ru',
         silent: true
      });

      try {
         await chldProcess.run();
      } catch (err) {
         throw err;
      }
   }
}

module.exports = Repository;
