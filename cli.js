#!/usr/bin/env node

const path = require('path');
const fs = require('fs-extra');

const Store = require('./app/store');
const Build = require('./app/build');
const Test = require('./app/test');
const Prepare = require('./app/prepare');
const logger = require('./app/util/logger');
const app = require('./app/app');
const DemoIndex = require('./src/DemoIndex/DemoIndex');
const Config = require('./src/Utils/Config');
const CreateModule = require('./app/createModule');

const initDevEnv = require('./cli/initDevEnv');

const ERROR_CODE = 2;
const LOG_FOLDER = 'log';
const STORE = path.join(__dirname, 'store/_repos');

/**
 * Модуль для запуска юнит тестов
 * @class Cli
 * @author Ганшин Я.О.
 */

class Cli {
   constructor() {
      this.config = new Config();
      this._prepareParams();

      const workspace = this.config.consoleParams.get('workspace');
      const nameCommand = this.config.command || this.config.params.get('tasks').join('_');

      // eslint-disable-next-line id-match
      logger.logFile = path.join(workspace || __dirname, LOG_FOLDER, `test-cli-${nameCommand}.log`);
      logger.logDir = path.join(workspace || __dirname, LOG_FOLDER);

      fs.outputFileSync(
         path.join(logger.logDir, `test_cli_${nameCommand}_options.json`),
         JSON.stringify(Array.from(this.config.params), null, 3)
      );
   }

   _prepareParams() {
      const params = this.config.params;

      if (params.has('store')) {
         let storePath = params.get('store');

         if (!path.isAbsolute(storePath)) {
            storePath = path.normalize(path.join(process.cwd(), storePath));
         }

         // TODO на _repos остались завязаны srv и скрипт сборки. В версии 2.x.x надо убрать эти привязки.
         params.set('store', path.join(storePath, '_repos'));
      } else {
         params.set('store', STORE);
      }

      if (!this.config.consoleParams.has('workDir') && params.has('workDir')) {
         params.set('workDir', path.join(process.cwd(), params.get('workDir')));
      }

      if (!params.has('workspace')) {
         params.set('workspace', params.get('workDir'));
      }

      if (!params.has('tasks')) {
         params.set('tasks', ['initStore', 'build', 'startTest']);
      }

      if (!params.has('builderCache')) {
         params.set('builderCache', './build-ui/builder-json-cache');
      }

      if (!params.has('rep')) {
         params.set('rep', ['all']);
      }

      if (!this.config.consoleParams.has('rep') && this.config.packageParams.has('rep')) {
         params.set('only', true);
      }

      if (params.has('projectDir') || params.has('project')) {
         params.set('buildTools', 'jinnee');
         params.set('resources', path.join(params.get('workDir'), 'intest-ps', 'ui', 'resources'));

         if (params.has('project')) {
            params.set('projectPath', params.get('project'));
         } else {
            const projectDir = params.get('projectDir');

            params.set('projectPath', projectDir ? path.join(projectDir, 'InTest.s3cld') : '');
         }
      } else {
         params.set('buildTools', 'builder');
         params.set('resources', params.get('workDir'));
      }
   }

   /**
    * Запускает сборку юнит тестов
    * @return {Promise<void>}
    */
   async run() {
      if (this.config.command === 'initDevEnv') {
         return initDevEnv(this.config);
      }

      const tasks = this.config.params.get('tasks');

      if (tasks.includes('initStore')) {
         await this.initStore();
      }

      if (tasks.includes('build')) {
         await this.build();
      }

      if (tasks.includes('startTest')) {
         await this.test();
      }

      if (tasks.includes('app')) {
         await this.app();
      }

      if (tasks.includes('prepare')) {
         await this.prepare();
      }

      if (tasks.includes('createIndex')) {
         await this.createIndex();
      }

      if (tasks.includes('createModule')) {
         await this.createModule();
      }
   }

   async build() {
      const build = new Build({
         options: this.config.params
      });

      await build.run();
   }

   async initStore() {
      const store = new Store({
         options: this.config.params
      });

      await store.run();
   }

   async test() {
      const test = new Test({
         options: this.config.params,
         only: this.config.params.get('only') || !!this.config.params.get('grep')
      });

      await test.run();
   }

   async prepare() {
      const makeTsConfig = new Prepare({
         options: this.config.params
      });

      await makeTsConfig.run();
   }

   async app() {
      await this.createIndex();

      return app.run(this.config.params);
   }

   async createIndex() {
      const createIndex = new DemoIndex({
         options: this.config.params
      });

      await createIndex.create();
   }

   async createModule() {
      const createModule = new CreateModule({
         options: this.config.params
      });

      await createModule.run();
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
