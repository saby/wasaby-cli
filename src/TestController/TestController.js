const pMap = require('p-map');
const fs = require('fs-extra');

const pathUtils = require('../Utils/path');
const logger = require('../Utils/Logger');

/**
 * Контроллер для тестов, определяет окружение и фреймворк для запуска тестов.
 * @author Кудрявцев И.С.
 */
class TestController {
   constructor(root, modules, options) {
      this.root = root;
      this.modules = modules;
      this.options = options;
      this.unitTestEnvironment = '';

      this.executors = {};

      if (this.options.get('NodeJS')) {
         this.unitTestEnvironment = 'NodeJS';
      }

      if (this.options.get('JSDOM') || this.options.get('server')) {
         this.unitTestEnvironment = 'JSDOM';
      }

      this.resultDir = pathUtils.join(this.options.get('artifactsDir'), 'UnitTests');
      this.runningTest = {};

      this.numberOfParallel = {
         NodeJS: this.options.get('parallelNodeJSTest') || 1,
         JSDOM: this.options.get('parallelJSDOMTest') || 1,
         Browser: 1,
         Jest: 1
      };

      this.initExecutors();
   }

   /**
    * Определяет окружения и фреймворки для юнит-тестов и запускает их.
    * @returns {Promise<void>}
    */
   async runUnitTest() {
      logger.info('Start unit testing');

      await this.runTests(this.getExecutors(['NodeJS', 'JSDOM']));
      await this.runTests(this.getExecutors(['Jest']));

      const serializeMeta = JSON.stringify(this.runningTest, null, 3);

      fs.outputFileSync(pathUtils.join(this.resultDir, 'testReports.json'), serializeMeta);

      // TODO Для совместимости записываем файл по старому пути. Удалить после отказа от параметра "workspace".
      if (this.options.has('workspace')) {
         fs.outputFileSync(pathUtils.join(this.options.get('workspace'), 'log', 'testOrder.json'), serializeMeta);
      }

      logger.info('Unit testing finished');
   }

   /**
    * Определяет окружения и фреймворки для браузерных тестов и запускает их.
    * @returns {Promise<void>}
    */
   async runBrowserTest(executorOptions) {
      logger.info('Start browser testing');

      await this.runTests(this.getExecutors(['Browser']), executorOptions);

      fs.outputFileSync(
         pathUtils.join(this.resultDir, 'testReports.json'),
         JSON.stringify(this.runningTest, null, 3)
      );

      logger.info('Browser testing finished');
   }

   /**
    * Запускает тесты.
    * @returns {Promise<void>}
    */
   async runTests(executorsByEnvironment, executorOptions = {}) {
      const tests = [];

      for (const [environment, executors] of Object.entries(executorsByEnvironment)) {
         tests.push(pMap(executors, async(executor) => {
            this.runningTest[executor.processName] = executor.reportPath;

            await executor.run(executorOptions);
         }, {
            concurrency: this.numberOfParallel[environment]
         }));
      }

      await Promise.all(tests);
   }

   /**
    * Инициализирует исполнителей для тестов.
    */
   initExecutors() {
      for (const module of this.modules) {
         if (module.isUnit()) {
            if (this.unitTestEnvironment) {
               this.addExecutor(module.framework, module.name, this.unitTestEnvironment, new Set([module]));

               continue;
            }

            if (module.needRunTestInBrowser) {
               this.addExecutor(module.framework, module.name, 'JSDOM', new Set([module]));
            }
         }

         this.addExecutor(module.framework, module.name, module.environment, new Set([module]));
      }
   }

   /**
    * Создаёт и добавляет исполнителей для тестов.
    * @param framework {String} Какой фреймворк использовать для тестирования.
    * @param moduleName {String} Имя модуля с тестами.
    * @param environment {String} Окружения в котором тестировать.
    * @param modules {Object[]} Список тестируемых модулей.
    */
   addExecutor(framework, moduleName, environment, modules) {
      const executor = this.createExecutor(framework, moduleName, environment, modules);

      if (!this.executors.hasOwnProperty(executor.environment)) {
         this.executors[executor.environment] = new Set();
      }

      this.executors[executor.environment].add(executor);
   }

   /**
    * Создаёт исполнителя для тестов.
    * @param framework {String} Какой фреймворк использовать для тестирования.
    * @param moduleName {String} Имя модуля с тестами.
    * @param environment {String} Окружения в котором тестировать.
    * @param modules {Object[]} Список тестируемых модулей.
    */
   createExecutor(framework, moduleName, environment, modules) {
      const Executor = TestController.loadExecutor(framework);

      return new Executor({
         processName: `${moduleName}_${environment}`,
         cacheDir: pathUtils.join(this.resultDir, 'cache'),
         resultPath: pathUtils.join(this.resultDir, moduleName, environment),
         root: this.root,
         options: this.options,
         modules,
         environment
      });
   }

   /**
    * Возвращает исполнителей промерживая их, если это локальный проект.
    * @param environments{String[]}
    * @returns {Object}
    */
   getExecutors(environments) {
      const result = {};

      for (const [environment, executors] of Object.entries(this.executors)) {
         if (environments.includes(environment)) {
            result[environment] = executors;
         }
      }

      return this.options.get('isLocaleProject') ? this.mergeExecutors(result) : result;
   }

   /**
    * Промерживает исполнителей, если у них одинаковый фреймворк и окружение.
    * @param executorsByEnvironment {Object} Исполнителе отсортированные по окружению.
    * @returns {Object}
    */
   mergeExecutors(executorsByEnvironment) {
      const result = { };

      for (const [environment, executors] of Object.entries(executorsByEnvironment)) {
         const modules = { };

         result[environment] = new Set();

         for (const executor of executors) {
            modules[executor.name] = [...(modules[executor.name] || []), ...executor.modules];
         }

         for (const [executorName, executorModules] of Object.entries(modules)) {
            result[environment].add(this.createExecutor(
                executorName,
                'Tests',
                environment,
                new Set(executorModules)
            ));
         }
      }

      return result;
   }

   /**
    * Загружает исполнителя.
    * @param name {String} Имя исполнителя.
    * @returns {*}
    */
   static loadExecutor(name) {
      return require(`./Executor/${name}`);
   }
}

module.exports = TestController;
