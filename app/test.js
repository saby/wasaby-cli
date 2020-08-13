const logger = require('./util/logger');
const xml = require('./xml/xml');
const Git = require('./util/git');

const fs = require('fs-extra');
const path = require('path');
const pMap = require('p-map');
const Base = require('./base');
const getPort = require('./net/getPort');
const fsUtil = require('./util/fs');

const BROWSER_SUFFIX = '_browser';
const NODE_SUFFIX = '_node';
const PARALLEL_TEST_COUNT = 2;
const TEST_TIMEOUT = 60 * 5 * 1000;
const REPORT_PATH = '{workspace}/artifacts/{module}/xunit-report.xml';
const ALLOWED_ERRORS_FILE = path.normalize(path.join(__dirname, '..', 'resources', 'allowedErrors.json'));

const _private = {

   /**
    * Возвращает шаблон xml файла
    * @returns {{testsuite: {$: {failures: string, tests: string, name: string, errors: string}, testcase: []}}}
    */
   getReportTemplate: () => ({
      testsuite: {
         $: {
            errors: '0',
            failures: '0',
            name: 'Mocha Tests',
            tests: '1'
         },
         testcase: []
      }
   }),

   /**
    * Возвращает шаблон тескейса c ошибкой для xml
    * @param {String} testName Название теста
    * @param {String} details Детализация ошибки
    * @returns {{$: {classname: string, name: string, time: string}, failure: *}}
    */
   getErrorTestCase: (testName, details) => ({
      $: {
         classname: `[${testName}]: Test runtime error`,
         name: 'Some test has not been run, see details',
         time: '0'
      },
      failure: details
   }),

   /**
    * Возвращает шаблон тескейса для xml
    * @param {String} testName Название теста
    * @returns {{$: {classname: string, name: string}}}
    */
   getSuccessTestCase: testName => ({
      $: {
         classname: `[${testName}]: Tests has not been run`,
         name: 'Tests has not been run, because can\'t found any changes in modules'
      }
   }),

   /**
    * Возвращает путь до конфига юнит тестов
    * @param {String} repName Название репозитрия
    * @param {Boolean} isBrowser - Юниты в браузере
    * @returns {string}
    * @private
    */
   getPathToTestConfig: (repName, isBrowser) => {
      const browser = isBrowser ? '_browser' : '';
      return fsUtil.relative(
         process.cwd(),
         path.normalize(path.join(__dirname, '..', `testConfig_${repName}${browser}.json`))
      );
   }
};

/**
 * Кслас запускающий юнит тестирование
 * @class Test
 * @author Ганшин Я.О
 */
class Test extends Base {
   constructor(cfg) {
      super(cfg);
      this._testReports = new Map();
      this._workspace = cfg.workspace || cfg.workDir;
      this._options = cfg;
      this._testErrors = {};
      this._report = cfg.report || 'xml';
      this._testOnlyBrowser = cfg.browser || cfg.server;
      this._allowedErrorsSet = new Set();
      this._diff = new Map();
      this._portMap = new Map();
      if (this._report === 'console') {
         logger.silent();
      }

      this._shouldUpdateAllowedErrors = false;
   }

   /**
    * Дописывает в отчеты название репозитория
    */
   prepareReport() {
      let promisArray = [];

      logger.log('Подготовка отчетов');
      this._testReports.forEach((filePath, name) => {
         if (fs.existsSync(filePath)) {
            let errorText = '';
            if (this._testErrors[name]) {
               errorText = this._testErrors[name].filter((msg) => {
                  const text = this._getErrorText(msg);
                  const isNotAllowed = !this._allowedErrorsSet.has(text);
                  if (isNotAllowed) {
                     logger.log(`Новая ошибка: "${text}"`, name);
                  }
                  return isNotAllowed;
               }).join('\n');
            }
            let readPromise = xml.readXmlFile(filePath).then((xmlObject) => {
               let result = xmlObject;
               if (result.testsuite && result.testsuite.testcase) {
                  result.testsuite.testcase.forEach((item) => {
                     item.$.classname = `${name}.${item.$.classname.replace(/\./g, ' ')}`;
                  });
               } else {
                  result = {
                     $: { errors: '0' },
                     testsuite: {
                        testcase: []
                     }
                  };
               }

               if (errorText) {
                  result.testsuite.testcase.push(_private.getErrorTestCase(name, errorText));
               }

               xml.writeXmlFile(filePath, result);
            }).catch(error => logger.error(error));

            promisArray.push(readPromise);
         }
      });
      return Promise.all(promisArray);
   }

   /**
    * Проверяет наличие отчетов по юнит тестам, если какого-то отчета нет кидает ошибку
    */
   checkReport() {
      let error = [];

      logger.log('Проверка существования отчетов');
      this._testReports.forEach((pathToReport, name) => {
         if (!fs.existsSync(pathToReport)) {
            error.push(name);
            xml.writeXmlFile(pathToReport, _private.getReportTemplate());
         }
      });
      if (error.length > 0) {
         logger.error(`Сгенерированы отчеты с ошибками: ${error.join(', ')}`);
      }
      logger.log('Проверка пройдена успешно');
   }

   /**
    * Возвращает конфиг юнит тестов на основе базового testConfig.base.json
    * @param {String|Array<String>>} names - Название репозитория
    * @param {String} suffix - browser/node
    * @param {Array<String>} testModules - модули с юнит тестами
    * @private
    */
   async _getTestConfig(names, suffix, testModules) {
      const testConfig = require('../testConfig.base.json');
      let cfg = { ...testConfig };
      const fullName = names + (suffix || '');
      let workspace = fsUtil.relative(this._options.workDir, this._options.workspace);
      const testModulesArray = testModules instanceof Array ? testModules : [testModules];
      workspace = workspace || '.';
      cfg.url = { ...cfg.url };
      this._port = await getPort(this._port ? this._port + 1 : undefined);
      cfg.url.port = this._port;
      this._portMap.set(names, this._port);
      cfg.tests = testModulesArray;
      cfg.root = fsUtil.relative(process.cwd(), this._options.resources);
      cfg.htmlCoverageReport = cfg.htmlCoverageReport.replace('{module}', fullName).replace('{workspace}', workspace);
      cfg.jsonCoverageReport = cfg.jsonCoverageReport.replace('{module}', fullName).replace('{workspace}', workspace);
      cfg.report = this.getReportPath(fullName);
      cfg.ignoreLeaks = !this._options.checkLeaks;
      cfg.nyc = {
         'include': [],
         'reportDir': path.dirname(cfg.jsonCoverageReport),
         'cwd': this._options.workDir,
         'report': ['json','text','html'].includes(this._options.coverage) ? this._options.coverage : 'html'
      };

      let nycPath;
      if (this._options.realResources) {
         nycPath = path.relative(this._options.workDir, this._options.realResources);
      }
      const namesArray = (names instanceof Array) ? names : [names];
      testModulesArray.forEach((testModuleName) => {
         const moduleCfg = this._modulesMap.get(testModuleName);
         if (moduleCfg && moduleCfg.depends) {
            moduleCfg.depends.forEach((dependModuleName) => {
               const dependModuleCfg = this._modulesMap.get(dependModuleName);
               if (dependModuleCfg && namesArray.includes(dependModuleCfg.rep)) {
                  let nycModulePath = [dependModuleName, '**', '*.js'];
                  if (nycPath) {
                     nycModulePath.unshift(nycPath);
                  }
                  cfg.nyc.include.push(nycModulePath.join('/'));
               }
            });
         }
      });
      if (await fs.exists(cfg.report)) {
         await fs.remove(cfg.report);
      }
      this._testReports.set(fullName, cfg.report);
      return cfg;
   }

   /**
    * Возвращает путь до конфига
    * @param {string} fullName - название модуля с тестами
    * @returns {string}
    */
   getReportPath(fullName) {
      const workspace = fsUtil.relative(process.cwd(), this._options.workspace);
      return REPORT_PATH.replace('{module}', fullName)
         .replace('{workspace}', workspace || '.');
   }

   /**
    * Проверят надо ли запускать юнит тесты по модулю
    * @param {String} moduleName Название модуля
    * @returns {Boolean}
    * @private
    */
   _shouldTestModule(moduleName) {
      const modulesCfg = this._modulesMap.get(moduleName);

      if (this._diff.has(modulesCfg.rep)) {
         const diff = this._diff.get(modulesCfg.rep);

         return diff.some(filePath => filePath.includes(moduleName + path.sep));
      }

      return true;
   }

   /**
    * Создает файл с конфигом для запуска юнит тестов
    * @param params - параметры для запуска юнит тестов
    * @returns {Promise<void>}
    * @private
    */
   async _makeTestConfig(params) {
      const cfg = await this._getTestConfig(
         params.name,
         params.isBrowser ? BROWSER_SUFFIX : NODE_SUFFIX,
         params.testModules
      );
      await fs.outputFile(
         params.path,
         JSON.stringify(cfg, null, 4)
      );
   }

   /**
    * Запускает юнит тесты
    * @returns {Promise<[]>}
    * @private
    */
   _startTest() {
      if (this._options.only) {
         // если тесты запускаются только по одному репозиторию то не разделяем их по модулям
         logger.log('Запуск тестов', this._options.testRep);
         return Promise.all([
            this._startNodeTest(this._options.testRep, this._modulesMap.getRequiredModules()),
            this._startBrowserTest(this._options.testRep, this._modulesMap.getRequiredModules())
         ]);
      }

      return pMap(this._modulesMap.getRequiredModules(), (moduleName) => {
         if (this._shouldTestModule(moduleName)) {
            logger.log('Запуск тестов', moduleName);
            return Promise.all([
               this._startNodeTest(moduleName),
               this._startBrowserTest(moduleName)
            ]);
         }

         this._createSuccessReport(moduleName);
         logger.log('Тесты не были запущены т.к. нет изменений в модуле', moduleName);

         return undefined;
      }, {
         concurrency: PARALLEL_TEST_COUNT
      });
   }

   /**
    * Создает отчет
    * @param {String} moduleName Название модуля с тестами
    * @private
    */
   _createSuccessReport(moduleName) {
      const report = _private.getReportTemplate();
      report.testsuite.testcase.push(_private.getSuccessTestCase(moduleName));
      xml.writeXmlFile(this.getReportPath(moduleName), report);
   }

   /**
    * Запускает юниты под нодой
    * @param {String} name - Название модуля
    * @param {Array<String>} testModules - Модули с тестами
    * @return {Promise<void>}
    * @private
    */
   async _startNodeTest(name, testModules) {
      if (!this._testOnlyBrowser) {
         const processName = name + NODE_SUFFIX;
         try {
            const pathToConfig = _private.getPathToTestConfig(name, false);

            await this._makeTestConfig({
               name: name,
               testModules: testModules || name,
               path: pathToConfig,
               isBrowser: false
            });

            const coverage = this._options.coverage ? '--coverage' : '';
            const report = this._report === 'xml' ? '--report' : '';
            const unitsPath = require.resolve('saby-units/cli.js');
            let args = [unitsPath, '--isolated', coverage, report, `--config=${pathToConfig}`].concat(
               this._getUnknownArgs()
            );
            await this._shell.spawn(
               'node',
               args,
               {
                  processName: processName,
                  timeout: TEST_TIMEOUT,
                  silent: this._report === 'console',
                  stdio: this._report === 'console' ? 'inherit' : 'pipe'
               }
            );

            //todo разобраться почему ошибки без стека, пока такие не учитываем
            this._testErrors[processName] = this._shell.getErrorsByName(processName);
            if (this._testErrors[processName]) {
               this._testErrors[processName] = this._testErrors[processName].filter(msg => msg.includes('Stack:'));
            }
         } catch (e) {
            this._testErrors[processName] = e;
         } finally {
            if (this._shouldUpdateAllowedErrors) {
               this._testErrors[processName].map((msg) => {
                  this._allowedErrorsSet.add(this._getErrorText(msg));
               });
            }
         }
      }
   }

   /**
    * Запускает тесты в браузере
    * @param {String} name - Название модуля с тестами либо репозиторий
    * @param {Array<String>} testModules - Модули с тестами
    * @return {Promise<void>}
    * @private
    */
   async _startBrowserTest(name, testModules) {
      const moduleCfg = this._modulesMap.get(name);
      if (
         !this._options.node &&
            (
               (moduleCfg && moduleCfg.testInBrowser) ||
               !moduleCfg ||
               this._testOnlyBrowser
            )
      ) {
         const configPath = _private.getPathToTestConfig(name, true);
         const coverage = this._options.coverage ? ' --coverage' : '';
         logger.log('Запуск тестов в браузере', name);

         await this._makeTestConfig({
            name: name,
            testModules: testModules || name,
            path: configPath,
            isBrowser: true
         });

         if (this._options.server) {
            await Promise.all([
               this._executeBrowserTestCmd(
                  `node ${require.resolve('saby-units/cli/server.js')} --config=${configPath}`,
                  name,
                  configPath,
                  0
               ),
               this._openBrowser(name)
            ]);
         } else {
            await this._executeBrowserTestCmd(
               `node ${require.resolve('saby-units/cli.js')} --browser${coverage} --report --config=${configPath}`,
               name,
               configPath,
               TEST_TIMEOUT
            );
         }

         logger.log('тесты в браузере завершены', name);
      }
   }

   /**
    * Открывает браузер
    * @param {String} moduleName - Название модуля
    * @returns {Promise<any>}
    * @private
    */
   _openBrowser(moduleName) {
      const url = `http://localhost:${this._portMap.get(moduleName)}`;
      const start = process.platform === 'win32' ? 'start' : 'xdg-open';
      return this._shell.execute(start + ' ' + url, process.cwd());
   }

   /**
    *
    * @param {String} cmd - shell команда которую надо выполнить
    * @param {String} moduleName - Название модуля
    * @param {String} configPath - Путь до конфига
    * @param {Number} timeout - таймаут для выполнения тестов
    * @returns {Promise<void>}
    * @private
    */
   async _executeBrowserTestCmd(cmd, moduleName, configPath, timeout) {
      try {
         await this._shell.execute(
            cmd,
            process.cwd(),
            {
               processName: `test browser ${moduleName}`,
               timeout: timeout
            }
         );
      } catch (errors) {
         if (errors.some(error => (error.includes('EADDRINUSE') || error.includes('ECHROMEDRIVER')))) {
            logger.log('Ошибка окружения, повторный запуск тестов', moduleName);
            await this._executeBrowserTestCmd(cmd, moduleName, configPath);
         } else {
            this._testErrors[moduleName + BROWSER_SUFFIX] = errors;
         }
      }
   }

   /**
    * Запускает тестирование
    * @return {Promise<void>}
    */
   async _run() {
      try {
         logger.log('Запуск тестов');
         await this._setDiff();
         await this._loadErrorsSet();
         await this._startTest();
         if (!this._options.server && this._report === 'xml') {
            await this.checkReport();
            await this.prepareReport();
         }
         await this._updateAllowedErrors();
         logger.log('Тестирование завершено');
      } catch (e) {
         e.message = `Тестирование завершено с ошибкой ${e}`;
         throw e;
      }
   }

   /**
    * Проверяет diff в репозитории для запуска тестов только по измененным модулям
    * @returns {Promise<[]>}
    * @private
    */
   _setDiff() {
      const result = [];
      if (this._options.diff) {
         for (const name of this._options.testRep) {
            if (name !== 'all') {
               result.push(this._setDiffByRep(name));
            }
         }
      }
      return Promise.all(result);
   }

   /**
    * Заполняет diff по репозиторию
    * @param repName Название репозитория
    * @returns {Promise<void>}
    * @private
    */
   async _setDiffByRep(repName) {
      const git = new Git({
         path: this._modulesMap.getRepositoryPath(repName),
         name: repName
      });
      const branch = await git.getBranch();
      if (this._options.rc && branch !== this._options.rc) {
         this._diff.set(repName, await git.diff(branch, this._options.rc));
      }
   }

   /**
    * Возвращает текст ошибки без цифр и пробелов
    * @param {String} text
    * @private
    */
   _getErrorText(text){
      let firstRow = text.split("\n")[0];
      return firstRow.replace(/[\d\[\]]/g,'').replace(/\s{2,}/g, ' ').trim();
   }

   /**
    * Обновляет список ошибок в файле
    * @private
    */
   async _updateAllowedErrors() {
      if (this._shouldUpdateAllowedErrors) {
         await fs.writeJSON(ALLOWED_ERRORS_FILE, Array.from(this._allowedErrorsSet));
      }
   }

   /**
    * Загружает список ошибок из файла
    * @returns {Promise<void>}
    * @private
    */
   async _loadErrorsSet() {
      const errors = await fs.readJSON(ALLOWED_ERRORS_FILE, Array.from(this._allowedErrorsSet));
      this._allowedErrorsSet = new Set(errors || []);
   }

   _getUnknownArgs() {
      let args = [];
      Object.keys(this._options.argvOptions).forEach((name) => {
         if (!this._options.hasOwnProperty(name)) {
            let value = this._options.argvOptions[name];
            value = value.includes(' ') ? `"${value}"` : value;
            args.push(`--${name}=${value}`);
         }
      });
      return args;
   }

}

module.exports = Test;
