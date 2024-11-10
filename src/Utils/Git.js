const logger = require('../Utils/Logger');
const GitProcess = require('../Process/Git');
const fs = require('fs-extra');

const pathUtils = require('../Utils/path');
const COMMIT_REG_EXP = /^[a-zA-Z\d]+$/;
const REG_EXP_CHECK_REMOTE = /\[remote "origin"]\s+url\s=\s[\w@.:/-]+\s+fetch/;

function cleanCMDResponse(data) {
   if (Array.isArray(data)) {
      return data.join('').split('\n').filter(row => !!row).map(row => row.trim());
   }

   return [];
}

/**
 * Класс-обертка над git-репозиторием, предоставляющий стандартные методы для работы с git.
 * @class Git
 */
class Git {
   /**
    * @param cfg.url {String} URL удаленного репозитория.
    * @param cfg.dir {String} Путь к директории, содержащей git-репозиторий.
    * @param [cfg.name] {String} Имя директории репозитория.
    * @param [cfg.path] {String} Путь к репозиторию.
    * @param [cfg.freezeStateOfCommits] {Boolean} Отключает все команды, которые могу влиять на состояние коммитов.
    * @param [cfg.cmd] {CMD} Инстанс консоли.
    */
   constructor(cfg) {
      this.url = cfg.url;
      this.dir = cfg.dir;
      this.name = cfg.name || Git.getNameFromUrl(this.url);
      this.path = cfg.path || pathUtils.join(this.dir, this.name);

      if (!fs.existsSync(this.dir)) {
         fs.ensureDirSync(this.dir);
      }

      this.freezeStateOfCommits = !!cfg.freezeStateOfCommits;
   }

   /**
    * Выполнить клонирование репозитория.
    * @param [options] {Object} Опции git команды clone.
    * @return {Promise<any>}
    */
   async clone(options) {
      logger.info(`git clone ${this.url} in directory ${this.dir}`, this.name);

      try {
         await this._execCommand(
            'clone',
            options,
            [
               this.url,
               this.name
            ],
            {},
            this.dir
         );
      } catch (err) {
         throw new Error(`Ошибка при клонировании репозитория ${this.name}: ${err}`);
      }
   }

   async isConnectedRemote() {
      let pathConfig = pathUtils.join(this.path, '.git', 'config');

      if (!fs.pathExistsSync(pathConfig)) {
         return false;
      }

      const gitConfig = await fs.readFile(pathUtils.join(this.path, '.git', 'config'), 'utf-8');

      return REG_EXP_CHECK_REMOTE.test(gitConfig);
   }

   /**
    * Выполнить загрузку объектов и ссылок из удаленного репозитория.
    * @param [options] {Object} Опции git команды fetch.
    * @return {Promise<any>}
    */
   async fetch(options) {
      if (this.freezeStateOfCommits) {
         return;
      }

      if (await this.isConnectedRemote()) {
         await this._execCommand(
            'fetch',
            options
         );

         return;
      }

      throw new Error(`${this.name}: No remote repository specified`);
   }

   /**
    * Выполнить загрузку объектов и ссылок из удаленного репозитория и промержит с локальными.
    * @param [options] {Object} Опции git команды pull.
    * @return {Promise<any>}
    */
   async pull(options) {
      if (this.freezeStateOfCommits) {
         return;
      }

      if (await this.isConnectedRemote()) {
         await this._execCommand(
            'pull',
            options
         );

         return;
      }

      throw new Error(`${this.name}: No remote repository specified`);
   }

   /**
    * Переключить репозиторий на определенную ревизию или ветку.
    * @param [options] {Object} Опции git команды reset.
    * @return {Promise<any>}
    */
   async reset(options) {
      if (this.freezeStateOfCommits) {
         return;
      }

      await this._execCommand(
         'reset',
         options
      );
   }

   /**
    * Выполнить очистку репозитория.
    * @param [options] {Object} Опции git команды clean.
    * @return {Promise<any>}
    */
   async clean(options) {
      if (this.freezeStateOfCommits) {
         return;
      }

      await this._execCommand(
         'clean',
         options
      );
   }

   /**
    * Переключить репозиторий на определенную ревизию или ветку.
    * @param revision {String} Ревизия или имя ветки, на которую необходимо переключиться.
    * @param [options] {Object} Опции git команды checkout.
    * @return {Promise<any>}
    */
   async checkout(revision, options) {
      if (this.freezeStateOfCommits) {
         return;
      }

      logger.info(`Checkout to branch ${revision}`, this.name);

      try {
         await this._execCommand(
            'checkout',
            options,
            [
               revision
            ]
         );
      } catch (err) {
         throw new Error(`Error checkout to ${revision} in repository ${this.name}: ${err}`);
      }
   }

   /**
    * Выполнить слияние текущей ветки с целевой.
    * @param branch {String} Имя ветки, с которой необходимо выполнить слияние.
    * @param [options] {Object} Опции git команды merge.
    * @return {Promise<any>}
    */
   async merge(branch, options) {
      if (this.freezeStateOfCommits) {
         return;
      }

      const mergeWith = Git.isBranch(branch) ? `remotes/origin/${branch}` : branch;

      logger.info(`Merge current branch with '${mergeWith}'`, this.name);

      try {
         await this._execCommand(
            'merge',
            options,
            [
               mergeWith
            ]
         );
      } catch (e) {
         await this._execCommand(
            'merge',
            {
               abort: true
            },
            [
               mergeWith
            ],
            {
               force: true
            }
         );

         throw new Error(`Conflict in repository ${this.name} when merging current branch with '${mergeWith}': ${e}`);
      }
   }

   async status(options) {
      await this._prepareConfigGit();

      const rawResult = await this._execCommand(
         'status',
         {
            short: true,
            ...options,
            porcelain: 'v1'
         }
      );

      return cleanCMDResponse(rawResult);
   }

   /**
    * Определить разницу между двумя ревизиями.
    * @param startRevision {String} Начальная ревизия или имя ветки.
    * @param endRevision {String} Конечная ревизия или имя ветки.
    * @param options {Object} Опции git команды diff.
    * @param useIndex {Boolean?} Использовать ли команду diff-index
    * @return {Promise<any>}
    */
   async diff(startRevision, endRevision, options, useIndex) {
      await this._prepareConfigGit();

      const rawResult = await this._execCommand(
         useIndex ? 'diff-index' : 'diff',
         options,
         [
            startRevision,
            endRevision
         ]
      );

      return cleanCMDResponse(rawResult);
   }

   /**
    * Выполнить операцию над веткой или ветками.
    * @param name {String} Имя ветки.
    * @param [options] {Object} Опции git команды branch.
    * @return {Promise<string[]>}
    */
   async branch(name, options) {
      const result = await this._execCommand(
         'branch',
         options,
         [
            name
         ],
         {
            maxBuffer: 1024 * 1024 * 2
         }
      );

      return cleanCMDResponse(result);
   }

   /**
    * Выполнить операцию над ревизией.
    * @param revision {String} Ревизия.
    * @param [options] {Object} Опции git команды rev-parse.
    * @return {Promise<any>}
    */
   async revParse(revision = 'HEAD', options) {
      const result = await this._execCommand(
         'rev-parse',
         options,
         [
            revision
         ]
      );

      return cleanCMDResponse(result)[0];
   }

   /**
    *
    * @param [branch]
    * @param [options] {Object}
    * @return {Promise<*|[]>}
    */
   async lsRemote(branch, options) {
      const result = await this._execCommand(
         'ls-remote',
         options,
         [
            `"${this.url}"`,
            `${branch ? `"refs/heads/${branch}"` : ''}`
         ]
      );

      return cleanCMDResponse(result);
   }

   async setHookPath(path) {
      await this._execCommand(
         'config',
         {},
         [
            'core.hooksPath',
            `"${path}"`
         ]
      );
   }

   /**
    * Выполнить git команду.
    * @param command {String} Команда git.
    * @param [options] {Object} Опции команды.
    * @param [params] {String[]} Параметры команды.
    * @param [cfg] {{silent?: boolean, maxBuffer?: number, force?: boolean}} Объект конфигурации для нового процесса.
    * @param [path] {String} Директория, в которой выполняется команда git.
    * @returns {Promise<any[]>}
    * @private
    */
   _execCommand(command, options, params, cfg, path) {
      const proc = new GitProcess({
         command,
         options,
         params,
         silent: true,
         processName: `${this.name} ${command}`,
         procOptions: {
            cwd: path || this.path
         },
         ...cfg
      });

      return proc.run();
   }

   _prepareConfigGit() {
      if (!this.configReady) {
         this.configReady = (async() => {
            // https://ru.stackoverflow.com/questions/770949/%D0%A0%D1%83%D1%81%D0%B8%D1%84%D0%B8%D0%BA%D0%B0%D1%86%D0%B8%D1%8F-git-%D0%B2-%D0%BA%D0%BE%D0%BD%D1%81%D0%BE%D0%BB%D0%B8
            await this._execCommand(
               'config',
               undefined,
               [
                  'core.quotepath',
                  false
               ]
            );

            return true;
         })();
      }

      return this.configReady;
   }

   static getNameFromUrl(url) {
      let name = url.replace('.git', '');

      if (name.startsWith('git@')) {
         return name.split(':')[1].replace(/\//g, '_');
      }

      name = name.replace('https://', '');

      return name.slice(name.indexOf('/') + 1).replace(/\//g, '_');
   }

   static async getInfo(repPath) {
      const rootRep = await Git.getRoot(repPath);
      const url = await Git.getUrl(repPath);

      return {
         url,
         dir: pathUtils.dirname(rootRep),
         name: Git.getNameFromUrl(url),
         path: rootRep
      };
   }

   static async getRoot(repPath) {
      try {
         const proc = new GitProcess({
            command: 'rev-parse',
            options: {
               'show-toplevel': true
            },
            silent: true,
            procOptions: {
               cwd: repPath
            }
         });
         const result = await proc.run();

         return result[0].trim();
      } catch (err) {
         throw err;
      }
   }

   static async getUrl(repPath) {
      try {
         const proc = new GitProcess({
            command: 'config',
            options: {
               'get': true
            },
            params: [
               'remote.origin.url'
            ],
            silent: true,
            procOptions: {
               cwd: repPath
            }
         });
         const result = await proc.run();

         return result[0].trim();
      } catch (err) {
         throw err;
      }
   }

   static isBranch(branch) {
      return !COMMIT_REG_EXP.test(branch);
   }
}

module.exports = Git;
