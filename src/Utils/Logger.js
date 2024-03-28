const fsExtra = require('fs-extra');
const fs = require('fs');
const pathUtils = require('./path');

class Logger {
   constructor() {
      this.channels = {};
      this.dir = process.cwd();
      this.label = 'wasaby-cli';
   }

   async open(config) {
      this.dir = config.dir;
      this.enableLabels = config.hasOwnProperty('enableLabels') ? !!config.enableLabels : true;

      this.consoleLevel = {
         info: true,
         debug: false
      };

      if (config.console.level === 'error') {
         this.consoleLevel.info = false;
      }

      if (config.console.level === 'debug') {
         this.consoleLevel.debug = true;
      }

      this.debugLogsPath = pathUtils.join(this.dir, 'debugLogs.log');

      const channels = await Promise.all([
         this.openChannel(this.debugLogsPath),
         this.openChannel(pathUtils.join(this.dir, 'errors.log')),
         this.openChannel(pathUtils.join(this.dir, 'logs.log'))
      ]);

      this.channels.debugLogFile = channels[0];
      this.channels.errorLogFile = channels[1];
      this.channels.logFile = channels[2];
   }

   async openChannel(path) {
      await fsExtra.outputFile(path, '', { encoding: 'utf8' });
      return fs.openSync(path, 'w+');
   }

   close() {
      if (this.channels.debugLogFile) {
         fs.closeSync(this.channels.debugLogFile);
         this.channels.debugLogFile = undefined;
      }

      if (this.channels.errorLogFile) {
         fs.closeSync(this.channels.errorLogFile);
         this.channels.errorLogFile = undefined;
      }

      if (this.channels.logFile) {
         fs.closeSync(this.channels.logFile);
         this.channels.logFile = undefined;
      }
   }

   debug(content, label) {
      const message = this._prepareMessage(content, label);

      if (this.consoleLevel.debug) {
         console.log(message);
      }

      this.writeInChannel(this.channels.debugLogFile, message);
   }

   error(error, label) {
      const message = typeof error === 'string' ? error : `${error.message}\n${error.stack}`;
      const errorMessage = `[ERROR]: ${this._prepareMessage(message, label)}`;

      console.error(errorMessage);

      this.writeInChannel(this.channels.debugLogFile, errorMessage);
      this.writeInChannel(this.channels.errorLogFile, errorMessage);
   }

   info(content, label) {
      const message = this._prepareMessage(content, label);

      if (this.consoleLevel.info) {
         console.log(message);
      }

      this.writeInChannel(this.channels.debugLogFile, message);
      this.writeInChannel(this.channels.logFile, message);
   }

   writeInChannel(channel, message) {
      fs.appendFileSync(channel, `${message.replace(/\x1b[[\d]+m/g, '')}\n`);
   }

   writeFile(path, content) {
      return fsExtra.outputFile(pathUtils.join(this.dir, path), content);
   }

   _prepareMessage(message, label) {
      if (this.enableLabels) {
         const date = new Date();
         const time = `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}:${date.getMilliseconds()}`;

         return `[${time}] ${label || this.label}: ${message}\n`;
      }

      return `${message}`;
   }
}

module.exports = new Logger();
