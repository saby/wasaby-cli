const fs = require('fs-extra');
const pMap = require('p-map');

const logger = require('../Utils/Logger');
const tensorFlow = require('../Utils/tensorFlow');
const Git = require('../Utils/Git');
const Module = require('../Module/Module');
const ModulesMap = require('../Map/Modules');
const pathUtils = require('../Utils/path');

const EXCLUDE_DIRS = [
   'node_modules',
   '_repos',
   'application',
   'build-ui'
];

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
    * @param [cfg.initialized] {Boolean} Индикатор, что репозиторий уже инициализирован.
    */
   constructor(cfg) {
      super(cfg);
      this.HEAD = cfg.HEAD;
      this.requiredBranch = cfg.requiredBranch;

      this.requireLoading = !!cfg.requireLoading;

      this.initialized = !!cfg.initialized;

      // TODO в репозитории Ядра созданы модули, которые используются в их юнит тестах.
      //  Названия этих модулей может пересекаться с реальными и они имеют зависимости на реальные модули.
      //  Приходиться задавать конкретную папку где искать модули, чтобы исключить попадания в карту тестовых.
      this.modulesDir = this.name === 'sbis_core' ? pathUtils.join(this.path, 'client') : this.path;

      this.changedFiles = new Map();
   }

   async shadowClone(branch) {
      await this.clone(`--depth 1 --branch ${branch} --single-branch`);

      this.initialized = true;
      this.freezeStateOfCommits = true;
   }

   async init() {
      if (this.initialized) {
         return;
      }

      if (!fs.pathExistsSync(this.path)) {
         await this.clone();
      } else {
         await this.update();
      }

      this.initialized = true;
   }

   isExcludedDir(pathDir) {
      if (!fs.lstatSync(pathDir).isDirectory()) {
         return true;
      }

      return fs.pathExistsSync(pathUtils.join(pathDir, 'metaInfo.json')) ||
         fs.pathExistsSync(pathUtils.join(pathDir, 'store.json'));
   }

   async findModules(path, modules) {
      try {
         const dirs = await fs.readdir(path);

         await pMap(dirs, async(dirName) => {
            if (EXCLUDE_DIRS.includes(dirName) || dirName.startsWith('.')) {
               return;
            }

            const pathDir = pathUtils.join(path, dirName);

            if (this.isExcludedDir(pathDir)) {
               return;
            }

            const pathS3mod = pathUtils.join(pathDir, `${dirName}.s3mod`);

            if (fs.pathExistsSync(pathS3mod)) {
               modules.add(pathS3mod);

               return;
            }

            await this.findModules(pathDir, modules);
         }, {
            concurrency: 20
         });
      } catch (err) {
         logger.debug(`Error finding modules in directory ${path}. Error: ${err}`);
      }
   }

   async getModules() {
      if (!this.modules) {
         const modulePaths = new Set();

         this.modules = new ModulesMap();

         await this.findModules(this.modulesDir, modulePaths);

         await pMap(modulePaths, async(modulePath) => {
            const module = await Module.buildModuleFromXml(modulePath, {
               repository: this
            });

            this.modules.add(module);
         }, {
            concurrency: 20
         });
      }

      return this.modules;
   }

   async detectCheckoutStrategy() {
      const result = {
         checkout: false,
         merge: false,
         pullAfterCheckout: false,
         pullBeforeCheckout: false
      };

      if (this.freezeStateOfCommits) {
         return result;
      }

      logger.info(`Detecting strategy for checkout in repository ${this.name}`);

      const [branch, mergeWith] = this.requiredBranch.split(':');

      result.checkout = branch;

      if (Git.isBranch(branch)) {
         if (tensorFlow.isRcBranch(branch)) {
            result.checkout = await tensorFlow.getNearestRcBranch(branch, this);
            result.pullAfterCheckout = true;

            return result;
         }

         const currentBranch = await this.revParse('HEAD', '--abbrev-ref');
         const parentBranch = tensorFlow.getRcBranch(branch);

         result.merge = mergeWith || parentBranch;

         if (currentBranch === branch || currentBranch === 'HEAD') {
            await this.checkout(parentBranch, '-f');
            result.pullBeforeCheckout = true;
         }

         try {
            await this.branch(branch, '-D');
         } catch (err) {
            // Если упало удаления ветки, то скорее всего её просто нет.
         }
      }

      return result;
   }

   async checkoutByStrategy(strategy) {
      if (strategy.pullBeforeCheckout) {
         await this.pull();
      }

      if (strategy.checkout) {
         await this.checkout(strategy.checkout, '-f');
      }

      if (strategy.pullAfterCheckout) {
         await this.pull();
      }

      if (strategy.merge) {
         await this.merge(strategy.merge);
      }
   }

   async delete(platform) {
      try {
         if (platform === 'win32') {
            await this._cmd.execute(`DEL /F/Q/S ${this.name} > NUL`, this.dir, {
               processName: `${this.name} delete`
            });

            await this._cmd.execute(`RMDIR /Q/S ${this.name}`, this.dir, {
               processName: `${this.name} delete`
            });

            return;
         }

         await this._cmd.execute(`sudo rm -rf ${this.name}`, this.dir, {
            processName: `${this.name} delete`
         });
      } catch (err) {
         throw err;
      }
   }

   /**
    * Выполняет git update
    * @returns {Promise<void>}
    */
   async update() {
      try {
         logger.info(`Updating repository ${this.name}`);

         await this.reset('--hard');
         await this.clean('-fdx');

         await this.fetch('--all --prune');
      } catch (err) {
         logger.info(`Recloning repository ${this.name}`);

         await this.delete(process.platform);
         await this.clone();
      }
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
      const files = await this.diff('', 'HEAD', '--cached --name-status', true);

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

      const files = await this.diff(`"${lastRevision}"`, 'HEAD', '--name-status');
      const result = this._sortDiffFiles(files);

      logger.debug(
         `Changed files for repository "${this.name}" and commit "${lastRevision}":${JSON.stringify(result, null, 3)}`
      );

      this.changedFiles.set(lastRevision, result);

      return result;
   }

   async getRemoteRevision(branch) {
      return (await this.lsRemote(branch))[0].split('\t')[0];
   }

   async getRemoteBranches(mask) {
      const branches = await this.lsRemote(mask, '--heads -q');
      const result = [];

      for (const branch of branches) {
         result.push((branch.split('\t')[1]).replace('refs/heads/', ''));
      }

      return result;
   }

   isCDN() {
      return this.name.endsWith('_cdn') || this.name.endsWith('-cdn');
   }

   /**
    * Получить сериализуемую часть инстанса.
    * @returns {Object} Сериализуемое содержимое инстанса.
    */
   serialize() {
      return {
         dir: this.dir,
         name: this.name,
         url: this.url,
         path: this.path,
         initialized: this.initialized,
         HEAD: this.HEAD
      };
   }
}

module.exports = Repository;
