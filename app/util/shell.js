const shell = require('shelljs');
const logger = require('./logger');
const cdn_path = 'intest-ps/ui';

/**
 * Класс для вызова shell команд
 * @class Shell
 * @author Ганшин Я.О
 */
class Shell {
   constructor() {
      this._childProcessMap = [];
   }

   /**
    * Параметры child_process.exec https://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback
    * @typedef ExecParams {Object}
    * @property {Boolean} force Если true в случае ошибки вернет промис resolve.
    * @property {String} processName Метка процесса в логах.
    * @property {String} errorLabel Метка, по которой сообщение в stdout будет распознано как ошибка.
    */
   /**
    * Выполняет команду shell
    * @param {String} command - текст команды
    * @param {String} path - путь по которому надо выполнить команду
    * @param {ExecParams} params
    * @return {Promise<any>}
    * @public
    */
   execute(command, path, params) {
      const errors = [];
      const result = [];
      const execParams = {
         async: true,
         silent: true,
         ...params
      };

      return new Promise((resolve, reject) => {
         const cloneProcess = shell.exec(`cd ${path} && ${command}`, execParams);
         this._childProcessMap.push(cloneProcess);

         cloneProcess.stdout.on('data', (data) => {
            logger.log(data, execParams.processName);
            if (execParams.errorLabel && data.includes(execParams.errorLabel)) {
               errors.push(data);
            } else {
               result.push(data.trim());
            }
         });

         cloneProcess.stderr.on('data', (data) => {
            logger.log(data, execParams.processName);
            errors.push(data);
         });

         cloneProcess.on('exit', (code, signal) => {
            this._childProcessMap.splice(this._childProcessMap.indexOf(cloneProcess), 1);
            if (signal === 'SIGTERM') {
               const message = `Process ${execParams.processName} has been terminated`;
               errors.push(message);
               logger.log(message, execParams.processName);
               reject(errors);
            } else if (execParams.force || (!code && !cloneProcess.withErrorKill)) {
               resolve(result);
            } else {
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
}

module.exports = Shell;
