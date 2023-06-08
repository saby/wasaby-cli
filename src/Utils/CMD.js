const childProcess = require('child_process');
const fs = require('fs-extra');

const logger = require('../Utils/Logger');

const whiteCodeList = [
   0,
   6
];

function isGoodExitCode(code) {
   return typeof code === 'undefined' || whiteCodeList.includes(code);
}

/**
 * Параметры child_process.exec https://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback
 * @typedef ExecParams {Object}
 * @property [force] {Boolean} Если true в случае ошибки вернет промис resolve.
 * @property [processName] {String} Метка процесса в логах.
 * @property [errorLabel] {String} Метка, по которой сообщение в stdout будет распознано как ошибка.
 * @property [silent] {Boolean} Отключить вывод сообщений в консоль.
 * @property [errorFilter] {Function} Функция фильтр для stderr.
 * @property [timeout] {Number} Время за которое должен завершиться процесс, если он не успел, то кидаем исключение.
 */

/**
 * Класс для вызова shell команд
 * @class CMD
 * @author Кудрявцев И.С.
 */
class CMD {
   constructor() {
      this._childProcessMap = [];
      this._errors = new Map();
   }

   /**
    * Выполняет команду shell
    * @param {Object | String} commandLine - текст команды
    * @param {String} [path] - путь по которому надо выполнить команду
    * @param {ExecParams} [params] Параметры
    * @return {Promise<any>}
    * @public
    */
   execute(commandLine, path, params) {
      if (path && !fs.pathExistsSync(path)) {
         throw new Error(`Directory ${path} not exists.`);
      }

      const execParams = {
         cwd: path || process.cwd(),
         ...params
      };

      const proc = childProcess.exec(CMD.buildCommandLine(commandLine), execParams);

      return this._subscribeProcess(proc, execParams);
   }

   /**
    * Выполняет команду shell
    * @param {Object} commandLine - Текст команды
    * @param {ExecParams} params Параметры
    * @return {Promise<any>}
    * @public
    */
   spawn(commandLine, params) {
      const env = commandLine.env || 'node';
      const args = CMD.buildCommandLine(commandLine, true);

      args.shift();

      const proc = childProcess.spawn(env, args, params);
      const proms = this._subscribeProcess(proc, params);

      return params.timeout ? this._getTimedOutProcess(proc, proms, params) : proms;
   }

   /**
    * Запускает исполняемый файл.
    * @param {String} modulePath Исполняемый модуль.
    * @param {String[]} args Аргументы вызова модуля.
    * @param {Object} options Опции запуска модуля.
    */
   static fork(modulePath, args, options) {
      return childProcess.fork(modulePath, args, options);
   }

   _getTimedOutProcess(proc, proms, params) {
      const timeoutHandler = setTimeout(() => {
         const message = `Process ${params.processName} has been terminated by timeout. Timeout: ${params.timeout} ms`;

         logger.error(message);
         this._errors.get(params.processName).push(message);

         proc.kill();
      }, params.timeout);

      return new Promise((resolve, reject) => {
         proms.then((response) => {
            clearTimeout(timeoutHandler);
            resolve(response);
         }).catch((err) => {
            clearTimeout(timeoutHandler);
            reject(err);
         });
      });
   }

   /**
    * Подписывается на дочерний процесс, возвращает промис, который резолвится по завершению процесса.
    * @param childProccess - ссылка на дочерний процесс
    * @param {ExecParams} params Параметры
    * @return {Promise<any>}
    * @private
    */
   _subscribeProcess(childProccess, params) {
      const errors = [];
      const result = [];

      this._errors.set(params.processName, errors);
      this._childProcessMap.push(childProccess);

      if (childProccess.stdout) {
         childProccess.stdout.on('data', (data) => {
            const dataString = data.toString();

            if (!params.silent) {
               logger.info(dataString, params.processName);
            } else {
               logger.debug(dataString, params.processName);
            }

            if (params.errorLabel && dataString.includes(params.errorLabel)) {
               errors.push(dataString);
            } else {
               result.push(dataString);
            }
         });
      }

      if (childProccess.stderr) {
         childProccess.stderr.on('data', (data) => {
            const dataString = data.toString();

            if (!params.silent) {
               logger.info(dataString, params.processName);
            } else {
               logger.debug(dataString, params.processName);
            }

            if (params.errorFilter) {
               if (params.errorFilter(dataString)) {
                  errors.push(dataString);
               }
            } else {
               errors.push(dataString);
            }
         });
      }

      return new Promise((resolve, reject) => {
         childProccess.on('exit', (code, signal) => {
            this._childProcessMap.splice(this._childProcessMap.indexOf(childProccess), 1);

            if (signal === 'SIGTERM' || signal === 'SIGINT' || signal === 'SIGKILL') {
               errors.push(`Exit code: ${code}`);
               reject(errors);
            } else if (params.force || (isGoodExitCode(code) && !childProccess.withErrorKill)) {
               resolve(result);
            } else {
               errors.push(`Exit code: ${code}`);
               reject(errors);
            }
         });
      });
   }

   /**
    * Закрвыает все дочерние процессы
    * @return {Promise<void>}
    * @public
    */
   async closeChildProcess() {
      await Promise.all(this._childProcessMap.map(process => (
         new Promise((resolve) => {
            process.on('close', () => {
               resolve();
            });
            process.withErrorKill = true;
            process.kill('SIGKILL');
         })
      )));

      this._childProcessMap = [];
   }

   /**
    * Возвращает ошибки по названию процесса
    * @param {String} name Название процесса
    * @returns {Array}
    */
   getErrorsByName(name) {
      return this._errors.get(name);
   }

   static prepareValue(value) {
      return value.toString().includes(' ') ? `"${value}"` : value;
   }

   static buildCommandLine(config, returnArray) {
      if (typeof config === 'string') {
         return config;
      }

      const line = [config.env || 'node'];

      if (config.file) {
         line.push(config.file.includes(' ') ? `"${config.file}"` : config.file);
      }

      if (config.command) {
         line.push(config.command);
      }

      for (const [name, value] of Object.entries(config.args)) {
         if (name.startsWith('opt#')) {
            line.push(CMD.prepareValue(value));

            continue;
         }

         if (value) {
            if (value === true) {
               line.push(`--${name}`);

               continue;
            }

            line.push(`--${name}${config.assignmentOperator || '='}${CMD.prepareValue(value)}`);
         }
      }

      return returnArray ? line : line.join(' ');
   }
}

module.exports = CMD;
