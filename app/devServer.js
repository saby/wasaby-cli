const fs = require('fs-extra');
const path = require('path');
const Shell = require('./util/shell');
const Sdk = require('./util/sdk');
const logger = require('./util/logger');
const Project = require('./xml/project');

let EXE = '';

if (process.platform === 'win32') {
   EXE = '.exe';
}

const DEFAULT_PORT = 2001;
const DB_CONNECTION = {
   host: 'localhost',
   port: 5432,
   login: 'postgres',
   password: 'postgres',
   dbName: 'InTest'
};

/**
 * Класс для управления локальным сервером
 * @class DevServer
 * @autor Ганшин Я.О.
 */

class DevServer {
   constructor(cfg) {
      this._shell = new Shell();
      this._workDir = cfg.workDir;
      this._host = cfg.host || 'localhost';
      this._port = cfg.port || DEFAULT_PORT;
      this._store = cfg.store;
      this._rc = cfg.rc;
      this._project = new Project({
         file: cfg.project
      });
      this._workspace = cfg.workspace;
      this._dbSchema = cfg.dbSchema;
      this._dbConnection = {
         host: cfg.dbHost || DB_CONNECTION.host,
         dbName:  cfg.dbName || DB_CONNECTION.dbName,
         login: cfg.dbLogin || DB_CONNECTION.login,
         password: cfg.dbPassword || DB_CONNECTION.password,
         port: cfg.dbPort || DB_CONNECTION.port
      };
   }

   /**
    * Создает ini файлы в сервисах
    * @returns {Promise<void>}
    */
   async createIni() {
      const pathService = path.join(this._workDir, await this._getServicePath());
      const pathServicePS = path.join(this._workDir, await this._getServicePathPS());

      await this._copyServiceIni(pathService);
      await this._copyServicePSIni(pathServicePS);
   }

   /**
    * Запускает сервер
    * @returns {Promise<void>}
    */
   async start() {
      await this._linkCDN();
      await this.createIni();

      process.on('SIGINT', async () => {
         await this.stop();
      });

      const pathService = path.join(this._workDir, await this._getServicePath());
      const pathServicePS = path.join(this._workDir, await this._getServicePathPS());

      await Promise.all([
         this._start(await this._getServicePath(), pathService),
         this._start(await this._getServicePathPS(), pathServicePS)
      ]);
   }

   /**
    * Останавливает сервер
    * @returns {Promise<void>}
    */
   async stop() {
      if (process.platform === 'win32') {
         await this._shell.execute(`taskkill /im sbis-daemon.exe /F`, process.cwd());
      } else {
         await Promise.all([
            this._stop(await this._getServicePath()),
            this._stop(await this._getServicePathPS())
         ]);
      }
   }

   /**
    * Запускает конвертацию бд
    * @returns {Promise<void>}
    */
   async convertDB() {
      const sdk = new Sdk({
         rc: this._rc,
         workspace: this._workspace
      });
      const dbSchema = await this._getDBShema();
      await this._prepareConvertCfg(dbSchema);
      await sdk.jinneeConvert(dbSchema, this._project.file);
   }

   /**
    * Запускает сервис
    * @param {String} name Название сервиса который нужно остановить
    * @private
    */
   async _start(name, workDir) {
      try {
         await this._shell.execute(
            `sbis-daemon${EXE} --http --port=${this._port}`,
            workDir
         );
      } catch(e) {
         logger.error(e);
         throw e;
      }
   }

   /**
    * Останавливает сервис
    * @param {String} name Название сервиса который нужно остановить
    * @private
    */
   async _stop(name) {
      try {
         this._shell.execute(
            `${this._workDir}/${name}/sbis-daemon${EXE} --name "${name}" stop`,
            process.cwd()
         );
      } catch(e) {
         logger.error(e);
         throw e;
      }
   }

   /**
    * Линкует cdn в корень сервиса
    * @returns {Promise<*>}
    * @private
    */
   async _linkCDN() {
      const service = await this._getServicePathPS();
      return fs.ensureSymlink(path.join(this._store, 'cdn'), path.join(this._workDir, service, 'ui', 'cdn'));
   }

   /**
    * Заменяет константы в конфиге конвертации
    * @param {String} filePath путь до конфига
    * @returns {Promise<void>}
    * @private
    */
   async _prepareConvertCfg(filePath) {
      let cfgString = await fs.readFile(filePath, 'utf8');
      cfgString = cfgString.replace(/{host}/g, this._dbConnection.host);
      cfgString = cfgString.replace(/{login}/g, this._dbConnection.login);
      cfgString = cfgString.replace(/{db_name}/g, this._dbConnection.dbName);
      cfgString = cfgString.replace(/{password}/g, this._dbConnection.password);
      cfgString = cfgString.replace(/{port}/g, this._dbConnection.port);
      await fs.outputFile(filePath, cfgString);
   }

   /**
    * Копирует ini файлы в сервис
    * @param service Директория в которой развернут сервис
    * @returns {Promise<void>}
    * @private
    */
   async _copyServiceIni(service) {
      let cfgString = await fs.readFile(path.join(process.cwd(), '/resources/sbis-rpc-service.base.ini'), 'utf8');
      cfgString = cfgString.replace(/{dbHost}/g, this._dbConnection.host);
      cfgString = cfgString.replace(/{dbLogin}/g, this._dbConnection.login);
      cfgString = cfgString.replace(/{dbName}/g, this._dbConnection.dbName);
      cfgString = cfgString.replace(/{dbPassword}/g, this._dbConnection.password);
      cfgString = cfgString.replace(/{dbPort}/g, this._dbConnection.port);
      cfgString = cfgString.replace(/{host}/g, this._host);
      cfgString = cfgString.replace(/{port}/g, this._port);
      await fs.outputFile(path.join(service, 'sbis-rpc-service.ini'), cfgString);
   }

   /**
    * Копирует ini файлы в сервис
    * @param service Директория в которой развернут сервис
    * @returns {Promise<void>}
    * @private
    */
   async _copyServicePSIni(service) {
      let cfgString = await fs.readFile(path.join(process.cwd(), '/resources/sbis-rpc-service.base.ps.ini'), 'utf8');
      cfgString = cfgString.replace(/{port}/g, this._port);
      await fs.outputFile(path.join(service, 'sbis-rpc-service.ini'), cfgString);
   }

   /**
    * Возвращет путь до схемы бд
    * @returns {Promise<*>}
    * @private
    */
   async _getDBShema() {
      if (!this._dbSchema) {
         const projectDir = path.dirname(this._project.file);
         const name = await this._project.getName();
         this._dbSchema = path.join(projectDir, `${name}.dbschema`);
      }
      return this._dbSchema;
   }

   /**
    * Возвращает название основного сервиса
    * @returns {Promise<string>}
    * @private
    */
   async _getServicePath() {
      return (await this._project.getName()).toLocaleLowerCase();
   }

   /**
    * Возвращает название сервиса представлений
    * @returns {Promise<string>}
    * @private
    */
   async _getServicePathPS() {
      const service = await this._getServicePath();
      return `${service}-ps`;
   }
}

module.exports = DevServer;
