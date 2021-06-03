#!/usr/bin/env node

const path = require('path');

const Store = require('./app/store');
const Build = require('./app/build');
const Test = require('./app/test');
const DevServer = require('./app/devServer');
const Prepare = require('./app/prepare');
const config = require('./app/util/config');
const logger = require('./app/util/logger');
const app = require('./app/app');
const CreateIndex = require('./app/createIndex');
const CreateModule = require('./app/createModule');

const ERROR_CODE = 2;
const LOG_FOLDER = 'log';
const STORE = path.join(__dirname, 'store')
/**
 * Модуль для запуска юнит тестов
 * @class Cli
 * @author Ганшин Я.О.
 */

class Cli {
   constructor() {
      this._argvOptions = Cli._getArgvOptions();
      const cfg = config.get(this._argvOptions);
      this._config = cfg;

      this._store = this._argvOptions.store || cfg.store || STORE;
      if (!path.isAbsolute(this._store)) {
         this._store = path.normalize(path.join(process.cwd(), this._store));
      }

      // на _repos остались завязаны srv и скрипт сборки пока это не убрать
      this._store = path.join(this._store, '_repos');
      this._rc = this._argvOptions.rc || cfg.rc;
      this.cdnVersion = this._argvOptions.cdn || cfg.cdn || this._rc;
      this._workDir = this._argvOptions.workDir || path.join(process.cwd(), cfg.workDir);
      this._workspace = this._argvOptions.workspace || this._workDir;
      this.tasks = this._argvOptions.tasks ? this._argvOptions.tasks.split(',') : ['initStore', 'build', 'startTest'];
      this._only = !!this._argvOptions.only;

      // eslint-disable-next-line id-match
      logger.logFile = path.join(this._argvOptions.workspace || __dirname, LOG_FOLDER, `test-cli-${this.tasks.join('_')}.log`);
      logger.logDir = path.join(this._argvOptions.workspace || __dirname, LOG_FOLDER);

      if (this._argvOptions.rep) {
         this._testRep = this._argvOptions.rep.split(',').map(name => name.trim());
      } else if (cfg.testRep) {
         this._testRep = cfg.testRep;
         this._only = true;
      } else {
         this._testRep = ['all'];
      }

      if (this._argvOptions.projectDir || this._argvOptions.project) {
         this._buildTools = 'jinnee';

         // если сборка идет джином то исходники лежат в  intest-ps/ui/resources
         this._resources = path.join(this._workDir, 'intest-ps', 'ui', 'resources');
         this._projectPath = this._argvOptions.projectDir ? path.join(this._argvOptions.projectDir, 'InTest.s3cld') : '';
         this._projectPath = this._argvOptions.project || this._projectPath;
      } else {
         this._buildTools = 'builder';
         this._resources = this._workDir;
      }

      this._builderCache = this._argvOptions.builderCache || './build-ui/builder-json-cache';
      /**
       * Признак того, что приложение запустится в режиме react-приложения
       * @type {boolean}
       * @private
       */
      this._reactApp = !!this._argvOptions.reactApp;
   }

   /**
    * Запускает сборку юнит тестов
    * @return {Promise<void>}
    */
   async run() {
      if (this.tasks.includes('initStore')) {
         await this.initStore();
      }
      if (this.tasks.includes('build')) {
         await this.build();
      }
      if (this.tasks.includes('startTest')) {
         await this.test();
      }
      if (this.tasks.includes('devServer')) {
         await this.devServer();
      }
      if (this.tasks.includes('app')) {
         await this.app();
      }
      if (this.tasks.includes('prepare')) {
         await this.prepare();
      }
      if (this.tasks.includes('createIndex')) {
         await this.createIndex();
      }
      if (this.tasks.includes('createModule')) {
         await this.createModule();
      }
   }

   async build() {
      const build = new Build({
         builderCache: this._builderCache,
         projectPath: this._projectPath,
         rc: this._rc,
         config: this._config,
         resources: this._resources,
         store: this._store,
         testRep: this._testRep,
         buildTools: this._buildTools,
         workDir: this._workDir,
         workspace: this._workspace,
         release: this._argvOptions.release,
         watcher: this._argvOptions.watcher,
         builderBaseConfig: this._argvOptions.builderConfig,
         only: this._only,
         pathToJinnee: this._argvOptions.pathToJinnee,
         argvOptions: this._argvOptions,
         copy: !!this._argvOptions.copy,
         //TODO Убрать когда возможность задать реализацию будет из корообки.
         isReact: this._argvOptions.react,
      });

      await build.run();
   }

   async initStore() {
      const store = new Store({
         argvOptions: this._argvOptions,
         rc: this._rc,
         cdnVersion: this.cdnVersion,
         config: this._config,
         store: this._store,
         testRep: this._testRep,
         only: this._only,
         projectPath: this._projectPath,
         resources: this._resources
      });

      await store.run();
   }

   async test() {
      const test = new Test({
         modules: this._argvOptions.modules ? this._argvOptions.modules.split(',') : [],
         config: this._config,
         resources: this._resources,
         store: this._store,
         testRep: this._testRep,
         workDir: this._workDir,
         workspace: this._workspace,
         only: this._only || !!this._argvOptions.grep,
         server: !!this._argvOptions.server,
         rc: this._rc,
         diff: this._argvOptions.diff,
         coverage: this._argvOptions.coverage,
         report: this._argvOptions.report,
         browser: this._argvOptions.browser,
         node: this._argvOptions.node,
         argvOptions: this._argvOptions,
         //TODO Убрать когда возможность задать реализацию будет из корообки.
         isReact: this._argvOptions.react,
      });
      throw "Test run tests Error";
      await test.run();
   }

   async devServer() {
      const devServer = new DevServer({
         workDir: this._workDir,
         store: this._store,
         rc: this._rc,
         port: this._argvOptions.port,
         project: this._argvOptions.project,
         workspace: this._workspace,
         dbHost: this._argvOptions.dbHost,
         dbName: this._argvOptions.dbName,
         dbLogin: this._argvOptions.dbLogin,
         dbPassword: this._argvOptions.dbPassword,
         dbPort: this._argvOptions.dbPort
      });

      if (this._argvOptions.start) {
         await devServer.start();
      } else if (this._argvOptions.stop) {
         await devServer.stop();
      } else if (this._argvOptions.convertDB) {
         await devServer.convertDB();
      } else if (this._argvOptions.createIni) {
         await devServer.createIni();
      }
   }

   async prepare() {
      const makeTsConfig = new Prepare({
         config: this._config,
         store: this._store,
         testRep: this._testRep,
         only: this._only,
         resources: this._resources,
         builderCache: this._builderCache,
         tsconfig: this._argvOptions.tsconfig || this._config.tsconfig,
         argvOptions: this._argvOptions
      });

      await makeTsConfig.run();
   }

   app() {
      const cfg = config.get();
      const port = this._argvOptions.port || cfg.port;
      const isDebug = !(this._argvOptions.release || cfg.release);
      const options = Object.assign({reactApp: this._reactApp}, this._config);

      return app.run(this._resources, port, isDebug, options);
   }

   async createIndex() {
      const createIndex = new CreateIndex({
         moduleName: this._argvOptions.moduleName,
         resources: this._resources,
         config: this._config,
         store: this._store,
         testRep: this._testRep,
         workDir: this._workDir,
         only: this._only,
         argvOptions: this._argvOptions
      });
      await createIndex.run();
   }

   async createModule() {
      const createModule = new CreateModule({
         rc: this._rc,
         config: this._config,
         store: this._store,
         testRep: this._testRep,
         only: this._only,
         resources: this._resources,
         path: this._argvOptions.path,
         argvOptions: this._argvOptions
      });

      await createModule.run();
   }

   /**
    * Возвращает опции командной строки
    * @private
    */
   static _getArgvOptions() {
      const options = {};
      process.argv.slice(2).forEach((arg) => {
         if (arg.startsWith('--')) {
            const argName = arg.substr(2);
            const [name, value] = argName.split('=', 2);
            options[name] = value === undefined ? true : value;
         }
      });

      return options;
   }
}

module.exports = Cli;

// eslint-disable-next-line id-match
if (require.main.filename === __filename) {
   // Если файл запущен напрямую запускаем run
   const cli = new Cli();
   cli.run().catch((e) => {
      logger.error(e);
      process.exit(ERROR_CODE);
   });
}
