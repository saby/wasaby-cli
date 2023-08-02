const logger = require('../Utils/Logger');
const CMD = require('./CMD');
const fs = require('fs-extra');

const pathUtils = require('../Utils/path');
const COMMIT_REG_EXP = /^[a-zA-Z\d]+$/;
const REG_EXP_CHECK_REMOTE = /\[remote "origin"]\s+url\s=\s[\w@.:/-]+\s+fetch/;

/**
 * Подготовить конфиг процесса для выполнения команды.
 * @param processName {String} Имя нового процесса.
 * @param cfg {{silent?: boolean, maxBuffer?: number, force?: boolean}} Объект конфигурации для нового процесса.
 * @return {{processName: string, silent?: boolean, maxBuffer?: number, force?: boolean}} Объект конфигурации для нового процесса.
 */
function createProcessConfig(processName, cfg) {
   const config = {
      processName
   };

   if (!cfg) {
      return config;
   }

   if (typeof cfg.force === 'boolean') {
      config.force = cfg.force;
   }
   if (typeof cfg.silent === 'boolean') {
      config.silent = cfg.silent;
   }
   if (typeof cfg.maxBuffer === 'number') {
      config.maxBuffer = cfg.maxBuffer;
   }

   return config;
}

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

      this.freezeStateOfCommits = !!cfg.freezeStateOfCommits;

      this._cache = new Map();
      this._cmd = cfg.cmd || new CMD();
   }

   /**
    * Выполнить клонирование репозитория.
    * @param options {String?} Опции git команды clone.
    * @return {Promise<any>}
    */
   async clone(options) {
      logger.info(`git clone ${this.url} in directory ${this.dir}`, this.name);

      try {
         await this._execCommand(
            this.dir,
            'clone',
            options,
            `${this.url} ${this.name}`,
            {
               silent: true
            }
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
    * @param [options] {String} Опции git команды fetch.
    * @return {Promise<any>}
    */
   async fetch(options) {
      if (this.freezeStateOfCommits) {
         return;
      }

      if (await this.isConnectedRemote()) {
         await this._execCommand(
            this.path,
            'fetch',
            options,
            null,
            {
               silent: true
            }
         );

         return;
      }

      throw new Error(`${this.name}: No remote repository specified`);
   }

   /**
    * Выполнить загрузку объектов и ссылок из удаленного репозитория и промержит с локальными.
    * @param [options] {String} Опции git команды pull.
    * @return {Promise<any>}
    */
   async pull(options) {
      if (this.freezeStateOfCommits) {
         return;
      }

      if (await this.isConnectedRemote()) {
         await this._execCommand(
            this.path,
            'pull',
            options,
            null,
            {
               silent: true
            }
         );

         return;
      }

      throw new Error(`${this.name}: No remote repository specified`);
   }

   /**
    * Переключить репозиторий на определенную ревизию или ветку.
    * @param [revision] {String} Ревизия или имя ветки, на которую необходимо переключиться.
    * @param [options] {String} Опции git команды reset.
    * @return {Promise<any>}
    */
   async reset(options) {
      if (this.freezeStateOfCommits) {
         return;
      }

      await this._execCommand(
         this.path,
         'reset',
         options,
         '',
         {
            silent: true
         }
      );
   }

   /**
    * Выполнить очистку репозитория.
    * @param options {String?} Опции git команды clean.
    * @return {Promise<any>}
    */
   async clean(options) {
      if (this.freezeStateOfCommits) {
         return;
      }

      await this._execCommand(
         this.path,
         'clean',
         options,
         null,
         {
            silent: true
         }
      );
   }

   /**
    * Переключить репозиторий на определенную ревизию или ветку.
    * @param revision {String} Ревизия или имя ветки, на которую необходимо переключиться.
    * @param options {String?} Опции git команды checkout.
    * @return {Promise<any>}
    */
   async checkout(revision, options) {
      if (this.freezeStateOfCommits) {
         return;
      }

      logger.info(`Checkout to branch ${revision}`, this.name);

      try {
         await this._execCommand(
            this.path,
            'checkout',
            options,
            revision,
            {
               silent: true
            }
         );
      } catch (err) {
         throw new Error(`Error checkout to ${revision} in repository ${this.name}: ${err}`);
      }
   }

   /**
    * Выполнить слияние текущей ветки с целевой.
    * @param branch {String} Имя ветки, с которой необходимо выполнить слияние.
    * @param options {String?} Опции git команды merge.
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
            this.path,
            'merge',
            options,
            mergeWith,
            {
               silent: true
            }
         );
      } catch (e) {
         await this._execCommand(
            this.path,
            'merge',
            '--abort',
            mergeWith,
            {
               force: true,
               silent: true
            }
         );

         throw new Error(`Conflict in repository ${this.name} when merging current branch with '${mergeWith}': ${e}`);
      }
   }

   async status(options) {
      await this._prepareConfigGit();

      const rawResult = await this._execCommand(
         this.path,
         '--no-pager status',
         `--short ${options} --porcelain=v1`,
         '',
         {
            silent: true
         }
      );

      return cleanCMDResponse(rawResult);
   }

   /**
    * Определить разницу между двумя ревизиями.
    * @param startRevision {String} Начальная ревизия или имя ветки.
    * @param endRevision {String} Конечная ревизия или имя ветки.
    * @param options {String?} Опции git команды diff.
    * @param useIndex {Boolean?} Использовать ли команду diff-index
    * @return {Promise<any>}
    */
   async diff(startRevision, endRevision, options, useIndex) {
      await this._prepareConfigGit();

      const rawResult = await this._execCommand(
         this.path,
         `--no-pager ${useIndex ? 'diff-index' : 'diff'}`,
         options,
         `${startRevision} ${endRevision}`,
         {
            silent: true
         }
      );

      return cleanCMDResponse(rawResult);
   }

   /**
    * Выполнить операцию над веткой или ветками.
    * @param name {String} Имя ветки.
    * @param options {String?} Опции git команды branch.
    * @return {Promise<string[]>}
    */
   async branch(name, options) {
      const result = await this._execCommand(
         this.path,
         '--no-pager branch',
         options,
         name,
         {
            silent: true,
            maxBuffer: 1024 * 1024 * 2
         }
      );

      return cleanCMDResponse(result);
   }

   /**
    * Выполнить операцию над ревизией.
    * @param revision {String} Ревизия.
    * @param options {String?} Опции git команды rev-parse.
    * @return {Promise<any>}
    */
   async revParse(revision, options) {
      const result = await this._execCommand(
         this.path,
         'rev-parse',
         options,
         revision,
         {
            silent: true
         }
      );

      return cleanCMDResponse(result)[0];
   }

   /**
    *
    * @param [branch]
    * @param [options]
    * @return {Promise<*|[]>}
    */
   async lsRemote(branch, options) {
      const result = await this._cmd.execute(
         `git --no-pager ls-remote ${options || ''} "${this.url}" ${branch ? `"refs/heads/${branch}"` : ''}`,
         this.path,
         {
            silent: true
         }
      );

      return cleanCMDResponse(result);
   }

   /**
    * Выполнить git команду.
    * @param path {String} Директория, в которой выполняется команда git.
    * @param cmd {String} Команда git.
    * @param opts {String?} Опции команды.
    * @param args {String?} Аргументы команды.
    * @param cfg {{silent?: boolean, maxBuffer?: number, force?: boolean}?} Объект конфигурации для нового процесса.
    * @returns {Promise<any[]>}
    * @private
    */
   _execCommand(path, cmd, opts, args, cfg) {
      let command = `git ${cmd}`;

      if (opts) {
         command += ` ${opts}`;
      }

      if (args) {
         command += ` ${args}`;
      }

      const processName = `${this.name} ${command}`;

      return this._cmd.execute(command, path, createProcessConfig(processName, cfg));
   }

   _prepareConfigGit() {
      if (!this.configReady) {
         this.configReady = (async() => {
            // https://ru.stackoverflow.com/questions/770949/%D0%A0%D1%83%D1%81%D0%B8%D1%84%D0%B8%D0%BA%D0%B0%D1%86%D0%B8%D1%8F-git-%D0%B2-%D0%BA%D0%BE%D0%BD%D1%81%D0%BE%D0%BB%D0%B8
            await this._cmd.execute('git config core.quotepath false', this.path, {
               silent: true
            });

            return true;
         })();
      }

      return this.configReady;
   }

   async setHookPath(path) {
      await this._cmd.execute(`git config core.hooksPath "${path}"`, this.path, {
         silent: true
      });
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
      const cmd = new CMD();

      try {
         const result = await cmd.execute('git rev-parse --show-toplevel', repPath, {
            silent: true
         });

         return result[0].trim();
      } catch (err) {
         throw err;
      }
   }

   static async getUrl(repPath) {
      const cmd = new CMD();

      try {
         const result = await cmd.execute('git config --get remote.origin.url', repPath, {
            silent: true
         });

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
