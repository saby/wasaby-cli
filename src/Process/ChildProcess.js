const childProcess = require('node:child_process');
const logger = require('../Utils/Logger');

const whiteCodeList = [
   0,
   6
];

function isGoodExitCode(code) {
   return typeof code === 'undefined' || whiteCodeList.includes(code);
}

/**
 * Класс обёртка над нодовской библиотекой child_process.
 * @class ChildProcess
 * @property [force] {Boolean} Если true в случае ошибки вернет промис resolve.
 */
class ChildProcess {
   /**
    * @param [cfg.type] {String} Какой метод из child_process использовать для создания процесса. По умолчанию exec.
    * @param [cfg.env] {String} В каком окружении запускать процесс. По умолчанию Node.js.
    * @param [cfg.exeFile] {String} Исполняем файл.
    * @param [cfg.command] {String} Исполняемая команда.
    * @param [cfg.options] {Object} Набор опций вызова.
    * @param [cfg.params] {Array} Набор параметров вызова.
    * @param [cfg.envArgs] {Object} Набор аргументов вызова для окружения.
    * @param [cfg.assignmentOperator] {String} Какой оператор использовать для присвоения значений аргументам. По умолчанию =.
    * @param [cfg.commandLine] {String} Полная консольная команда строкой, используется только для метода exec.
    * @param [cfg.procOptions] {Object} Набор набор опций для функции child_process.
    * @param [cfg.processName] {String} Метка процесса в логах.
    * @param [cfg.silent] {Boolean} Отключить вывод сообщений в консоль.
    * @param [cfg.timeout] {Number} Время за которое должен завершиться процесс, если он не успел, то кидаем исключение.
    * @param [cfg.force] {Boolean} Если true, в случае ошибки вернет успешный промис.
    * @param [cfg.onError] {Function} Обработчик для события, когда приходят данные в stderr.
    * @param [cfg.onData] {Function} Обработчик для события, когда приходят данные в stdout.
    * @param [cfg.onMessage] {Function} Обработчик для события, когда приходят сообщения из процесса. Доступно только для fork.
    * @param [cfg.versionController] {VersionController} Контроллер версии для окружения, в котором запускается процесс.
    */
   constructor(cfg) {
      this.errors = [];
      this.type = cfg.type || 'exec';
      this.force = !!cfg.force;
      this.silent = !!cfg.silent;
      this.timeout = cfg.timeout;
      this.processName = cfg.processName;
      this.commandLine = cfg.commandLine;
      this.versionController = cfg.versionController;
      this.assignmentOperator = cfg.assignmentOperator || '=';
      this.command = cfg.command;

      this.onError = cfg.onError || function(data, result, errors) {
         errors.push(data);
      };
      this.onData = cfg.onData || function(data, result) {
         result.push(data);
      };
      this.onMessage = cfg.onMessage;

      this.env = cfg.env || 'node';
      this.exeFile = cfg.exeFile || '';
      this.procOptions = cfg.procOptions;

      this.options = cfg.options || {};
      this.params = cfg.params || [];
      this.envArgs = cfg.envArgs || {};
   }

   async run() {
      if (this.versionController) {
         await this.versionController.checkSupport();
      }

      this._createProcess();

      return this.promise;
   }

   _createProcess() {
      const args = this.buildArgs();
      const envArgs = this.buildOptions(this.envArgs);

      if (this.command) {
         args.unshift(this.command);
      }

      switch (this.type) {
         case 'fork': {
            this.process = childProcess.fork(this.exeFile, args, {
               execArgv: envArgs,
               silent: this.silent,
               ...this.procOptions
            });

            break;
         }
         case 'spawn': {
            const argsProc = this.exeFile ? [...envArgs, this.exeFile, ...args] : [...envArgs, ...args];

            this.process = childProcess.spawn(this.env, argsProc, this.procOptions);

            break;
         }
         case 'exec': {
            const argsProc = this.commandLine || [this.env, ...envArgs, this.exeFile, ...args].join(' ');

            this.process = childProcess.exec(argsProc, this.procOptions);

            break;
         }
         default: {
            throw new Error(`Child process type ${this.type} is not support.`);
         }
      }

      this._subscribeProcess();
   }

   /**
    * Подписывается на дочерний процесс, возвращает промис, который резолвится по завершению процесса.
    */
   _subscribeProcess() {
      const result = [];

      if (this.process.stdout) {
         this.process.stdout.on('data', (data) => {
            const dataString = data.toString();

            if (!this.silent) {
               logger.info(dataString, this.processName);
            } else {
               logger.debug(dataString, this.processName);
            }

            this.onData(dataString, result, this.errors);
         });
      }

      if (this.process.stderr) {
         this.process.stderr.on('data', (data) => {
            const dataString = data.toString();

            if (!this.silent) {
               logger.info(dataString, this.processName);
            } else {
               logger.debug(dataString, this.processName);
            }

            this.onError(dataString, result, this.errors);
         });
      }

      if (this.onMessage) {
         this.process.on('message', this.onMessage);
      }

      const promise = new Promise((resolve, reject) => {
         this.process.on('exit', (code, signal) => {
            if (signal === 'SIGTERM' || signal === 'SIGINT' || signal === 'SIGKILL') {
               logger.debug(`Exit code: ${code}`, this.processName);

               reject(this.errors);
            } else if (this.force || (isGoodExitCode(code) && !this.process.withErrorKill)) {
               resolve(result);
            } else {
               logger.debug(`Exit code: ${code}`, this.processName);

               reject(this.errors);
            }
         });
      });

      this.promise = this.timeout ? this._wrapTimeout(promise) : promise;
   }

   _wrapTimeout(proms) {
      const timeoutHandler = setTimeout(() => {
         const message = `Process ${this.processName} has been terminated by timeout. Timeout: ${this.timeout} ms`;

         logger.error(message);
         this.errors.push(message);

         this.process.kill();
      }, this.timeout);

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

   buildOptions(options) {
      const result = [];

      for (const [name, value] of Object.entries(options)) {
         const prefixOption = name.length === 1 ? '-' : '--';

         if (value) {
            if (value === true) {
               result.push(`${prefixOption}${name}`);

               continue;
            }

            if (Array.isArray(value)) {
               value.forEach((arrValue) => {
                  result.push(`${prefixOption}${name}${this.assignmentOperator}${ChildProcess.prepareValue(arrValue)}`);
               });

               continue;
            }

            result.push(`${prefixOption}${name}${this.assignmentOperator}${ChildProcess.prepareValue(value)}`);
         }
      }

      return result;
   }

   buildParams() {
      const result = [];

      for (const value of this.params) {
         result.push(ChildProcess.prepareValue(value));
      }

      return result;
   }

   buildArgs() {
      const params = this.buildParams();
      const options = this.buildOptions(this.options);

      return [...params, ...options];
   }

   static prepareValue(value) {
      return value.toString().includes(' ') ? `"${value}"` : value;
   }
}

module.exports = ChildProcess;
