/**
 * Модуль для работы с консолью
 * @author Ганшин Я.О
 */
const fs = require('fs-extra');
const path = require('path');

/**
 * Выводит сообщение в лог
 * @class Logger
 */
class Logger {
   constructor() {
      this._enableLog = true;
   }

   /**
    * Устанавливает путь до файла с логами
    * @param {String} file
    */
   set logFile(file) {
      this._logFile = file;
   }

   /**
    * Возвращает путь до лог файла
    * @returns {String}
    */
   get logFile() {
      return this._logFile;
   }

   set logDir(logDir) {
      this._logDir = logDir;
   }

   get logDir() {
      return this._logDir;
   }

   writeLogFile(name, content) {
      fs.outputFileSync(path.join(this.logDir, name), content);
   }

   /**
    * Выводит сообщение в лог
    * @param {String} message Сообщение
    * @param {String} label Метка сообщения в логе
    */
   log(message, label = '') {
      if (!this._enableLog) {
         return;
      }

      const date = new Date();
      const time = `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}:${date.getMilliseconds()}`;
      const logLabel = label ? ' ' + label : '';
      const logMessage = `[${time}]${logLabel}: ${message}`;
      // eslint-disable-next-line no-console
      console.log(logMessage);
      this._log(logMessage);
   }

   /**
    * Выводит ошибку в лог
    * @param message
    */
   error(message) {
      // eslint-disable-next-line no-console
      console.error(message);
      this._log(`[ERROR]: ${message}`, { flag: 'a' });
   }

   /**
    * Выключает логирование
    */
   silent() {
      this._enableLog = false;
   }

   /**
    * Логирует сообщение в файл
    * @param {String} message
    */
   _log(message) {
      if (this.logFile) {
         try {
            fs.outputFileSync(this.logFile, message, { flag: 'a' });
         } catch (e) {
            this.logFile = false;
            // eslint-disable-next-line no-console
            console.error(`Ошибка создания лог файла: ${e}`);
         }
      }
   }
}

module.exports = new Logger();
