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
const MAX_TEST_RESTART = 5;

const AVAILABLE_REPORT_FORMAT = ['json', 'html', 'text'];

/**
 * Постепенно раскатаем Jest по репозиториям, чтобы не ломать всё и сразу.
 * Сюда запишем имена тех репозиториев, для которых необходимо запускать Jest для unit-тестирования.
 */
const JEST_ALLOWED_REPOS = [
   'saby-ui'
];
const SNAPSHOT_RESOLVER_PREFIX = 'snapshot-resolver_';
const JEST_FRAMEWORK_ENABLED = true;

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
    * Возвращает путь до Mocha конфига юнит тестов
    * @param {String} repName Название репозитрия
    * @param {Boolean} isBrowser - Юниты в браузере
    * @returns {string}
    * @private
    */
   getPathToTestConfig: (repName, isBrowser) => {
      const browser = isBrowser ? BROWSER_SUFFIX : '';
      return fsUtil.relative(
         process.cwd(),
         path.normalize(path.join(__dirname, '..', `testConfig_${repName}${browser}.json`))
      );
   },

   /**
    * Возвращает путь до Jest конфига юнит тестов
    * @param repName {String} Название репозитория
    * @param isBrowser {Boolean} Юниты в браузере
    * @returns {string}
    * @private
    */
   getPathToJestTestConfig: (repName, isBrowser) => {
      const browser = isBrowser ? BROWSER_SUFFIX : '';
      return fsUtil.relative(
         process.cwd(),
         path.normalize(path.join(__dirname, '..', `jestTestConfig_${repName}${browser}.json`))
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
      this.only = cfg.only;
      this._testReports = new Map();
      this._testErrors = {};
      this._report = this.options.get('report') || 'xml';
      this._testOnlyBrowser = this.options.get('browser') || this.options.get('server');
      this._allowedErrorsSet = new Set();
      this._diff = new Map();
      this._portMap = new Map();
      this._restartCounter = {};
      this.startedTests = {};

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
    * Возвращает Mocha конфиг юнит тестов на основе базового testConfig.base.json
    * @param {String|Array<String>} names - Название репозитория
    * @param {String} suffix - browser/node
    * @param {Array<String>} testModules - модули с юнит тестами
    * @private
    */
   async _getTestConfig(names, suffix, testModules) {
      const cfg = {...require('../testConfig.base.json')};
      const fullName = `${names}${suffix || ''}`;

      // options of browser units
      cfg.url = { ...cfg.url };
      cfg.url.port = await getPort();
      this._portMap.set(names, cfg.url.port);

      // common options
      cfg.tests = testModules instanceof Array ? testModules : [testModules];
      cfg.root = fsUtil.relative(process.cwd(), this.options.get('resources'));
      cfg.report = this.getReportPath(fullName);
      cfg.ignoreLeaks = true;

      this.startedTests[fullName] = cfg.report;

      // coverage options
      const workspace = fsUtil.relative(this.options.get('workDir'), this.options.get('workspace')) || '.';

      cfg.htmlCoverageReport = cfg.htmlCoverageReport.replace('{module}', fullName).replace('{workspace}', workspace);
      cfg.jsonCoverageReport = cfg.jsonCoverageReport.replace('{module}', fullName).replace('{workspace}', workspace);
      cfg.nyc = {
         include: [],
         reportDir: path.dirname(cfg.jsonCoverageReport),
         cwd: this.options.get('workDir'),
         report: AVAILABLE_REPORT_FORMAT.includes(this.options.get('coverage')) ? this.options.get('coverage') : 'html'
      };

      const nycPath = path.relative(this.options.get('workDir'), this.options.get('resources'));
      const namesArray = (names instanceof Array) ? names : [names];

      cfg.tests.forEach((testModuleName) => {
         const moduleCfg = this._modulesMap.get(testModuleName);

         if (!(moduleCfg && moduleCfg.depends)) {
            return;
         }

         moduleCfg.depends.forEach((dependModuleName) => {
            const dependModuleCfg = this._modulesMap.get(dependModuleName);

            if (!this.only || (dependModuleCfg && namesArray.includes(dependModuleCfg.rep))) {
               cfg.nyc.include.push(`${nycPath ? nycPath + '/' : ''}${dependModuleName.replace(/ /g, '_')}/**/*.js`);
            }
         });
      });

      // deleting old report
      if (await fs.exists(cfg.report)) {
         await fs.remove(cfg.report);
      }

      this._testReports.set(fullName, cfg.report);

      return cfg;
   }

   /**
    * Получить описание тестируемых модулей (имя, пути к build/source).
    * @param config {object} Параметры конфигурации Jest.
    * @returns {{uiModules: string[], buildPaths: string[], sourcePaths: string[]}}
    * @private
    */
   _getUIModulesPaths(config) {
      const uiModules = Array.isArray(config.testModules) ? config.testModules : [config.testModules];
      const buildPaths = uiModules.map((moduleName) => path.join(this.options.get('resources'), moduleName));
      const sourcePaths = uiModules.map((moduleName) => this._modulesMap.get(moduleName).path);

      return {
         uiModules,
         buildPaths,
         sourcePaths
      };
   }

   /**
    * Возвращает Jest конфиг юнит тестов на основе базового jestTestConfig.base.json
    * @param config - параметры для запуска юнит тестов
    * @private
    */
   async _getJestTestConfig(config) {
      const suffix = config.isBrowser ? BROWSER_SUFFIX : NODE_SUFFIX;
      const fullName = `${config.name}${suffix || ''}`;
      const cfg = {...require('../jestTestConfig.base.json')};
      // Корневая директория с скомпилированными файлами (параметр --copy обязателен)
      const applicationDir = this.options.get('resources');
      // Директория ветки, либо корневая директория локального репозитория для кеша и артефактов
      const workspace = this.options.get('workspace') || '.';
      const coverageDirectory = path.join(workspace, 'artifacts', fullName);
      // Директория, в которой хранится кеш для фреймворка Jest
      const cacheDir = path.join(workspace, 'jest-cache');
      // Установочный файл, в котором выполняется инициализация окружения
      const setupFilePath = path.join(
         path.dirname(require.resolve('saby-units/cli.js')),
         'lib/jest/setup.js'
      );
      // Список путей к UI-модулям, в которых происходит поиск тестов и анализ покрытия
      const roots = this._getUIModulesPaths(config).buildPaths;

      cfg.displayName = fullName;
      cfg.rootDir = applicationDir;
      cfg.roots = roots;
      cfg.moduleDirectories.push(applicationDir);
      cfg.cacheDirectory = cacheDir;
      cfg.collectCoverage = !!this.options.get('coverage');
      cfg.collectCoverageFrom = [
         '**/*.{js,jsx}'
      ];
      cfg.coverageDirectory = coverageDirectory;
      if (this.only) {
         cfg.coverageReporters.push('text');
      }
      cfg.setupFilesAfterEnv.push(setupFilePath);
      cfg.globals['__SABY_APPLICATION_DIRECTORY__'] = applicationDir;
      cfg.globals['__SABY_LOAD_CSS__'] = suffix === BROWSER_SUFFIX;
      cfg.globals['__SABY_DEBUG_MODE__'] = true;
      cfg.snapshotResolver = config.snapshotResolverPath;
      cfg.testEnvironmentOptions.url = `http://localhost:${config.port}`;
      cfg.testEnvironmentOptions.referrer = `http://localhost:${config.port}`;

      if (!this.only) {
         logger.log(`[JEST CONFIG]`);
         logger.log(JSON.stringify(cfg, null, ' '));
      }
      return cfg;
   }

   /**
    * Возвращает путь до конфига
    * @param {string} fullName - название модуля с тестами
    * @returns {string}
    */
   getReportPath(fullName) {
      const workspace = fsUtil.relative(process.cwd(), this.options.get('workspace'));
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
      //TODO Удалить, довабил по ошибке https://online.sbis.ru/opendoc.html?guid=4c7b5d67-6afa-4222-b3cd-22b2e658b3a8
      if (modulesCfg !== undefined) {
         if (this._diff.has(modulesCfg.rep)) {
            const diff = this._diff.get(modulesCfg.rep);
            return diff.some(filePath => filePath.includes(moduleName + path.sep));
         }
         return true;
      }
   }

   /**
    * Проверяет, нужно ли запускать юнит тесты под Jest
    * @param moduleName {String} Название модуля
    * @private
    */
   _shouldRunJestFramework(moduleName) {
      if (!JEST_FRAMEWORK_ENABLED) {
         return false;
      }

      // Если this.only, то moduleName - имя тестируемого репозитория, иначе это имя тестируемого модуля.
      const repName = this.only ? moduleName : this._modulesMap.get(moduleName).rep;

      return JEST_ALLOWED_REPOS.includes(repName);
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
    * Создать JS-скрипт для разрешения путей к снимкам,
    * содержащий паравило для отображения build <-> source файлов.
    * @param config {object} Параметры конфигурации Jest.
    * @private
    */
   async _makeJestSnapshotResolver(config) {
      const baseResolverPath = path.join(__dirname, '../snapshot-resolver.base.js');
      const baseResolverSource = await fs.readFile(baseResolverPath, 'utf-8');

      const uiModulesPaths = this._getUIModulesPaths(config);
      const sourceModules = JSON.stringify(uiModulesPaths.sourcePaths, null, ' ').slice(1, -1);
      const buildModules = JSON.stringify(uiModulesPaths.buildPaths, null, ' ').slice(1, -1);

      const buildDirectory = this.options.get('resources');
      const testUIModuleName = uiModulesPaths.uiModules[0];
      const testPathForConsistencyCheck = path.join(buildDirectory, testUIModuleName, 'Component/index.js');

      const resolverSource = baseResolverSource
         .replace('/*#SOURCE_MODULES#*/', sourceModules)
         .replace('/*#BUILD_MODULES#*/', buildModules)
         .replace('/*#TEST_PATH_FOR_CONSISTENCY_CHECK#*/', testPathForConsistencyCheck);

      await fs.outputFile(
         config.snapshotResolverPath,
         resolverSource
      );
   }

   /**
    * Создает файл с Jest конфигом для запуска юнит тестов
    * @param config - параметры для запуска юнит тестов
    * @returns {Promise<void>}
    * @private
    */
   async _makeJestTestConfig(config) {
      const cfg = await this._getJestTestConfig(config);
      await fs.outputFile(
         config.path,
         JSON.stringify(cfg, null, 4)
      );
   }

   /**
    * Запускает юнит тесты
    * @returns {Promise<[]>}
    * @private
    */
   _startTest() {
      if (this.only) {
         // если тесты запускаются только по одному репозиторию то не разделяем их по модулям
         const repository = this.options.get('rep')[0];
         const modules = this._modulesMap.getTestModulesByRep(repository);

         logger.log('Запуск тестов', repository);

         return Promise.all([
            this._startNodeTest(repository, modules),
            this._startBrowserTest(repository, modules)
         ]);
      }

      return pMap(this._modulesMap.getUnitsTestModules(this.options.get('modules')), (moduleName) => {
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
    * Запускает юниты на Jest
    * @param name{String} Название модуля
    * @param testModules {Array<String>} Модули с тестами
    * @param isBrowser {Boolean} Флаг запуска тестов в окружении jsdom
    * @returns {Promise<void>}
    * @private
    */
   async _startJestTest(name, testModules, isBrowser) {
      const suffix = isBrowser ? BROWSER_SUFFIX : NODE_SUFFIX;
      const fullName = `${name}${suffix}`;
      try {
         const snapshotResolverPath = path.join(__dirname, '..', `${SNAPSHOT_RESOLVER_PREFIX}${name}${suffix}.js`);
         const port = await getPort();
         const pathToConfig = _private.getPathToJestTestConfig(name, isBrowser);
         const config = {
            name: name,
            testModules: testModules || name,
            path: pathToConfig,
            isBrowser: isBrowser,
            snapshotResolverPath: snapshotResolverPath,
            port: port
         };

         // TODO: Нужен хороший флаг
         const isCI = !this.only;
         const unitsPath = require.resolve('saby-units/cli.js');
         const outputFile = this.getReportPath(fullName);
         const otherArguments = this._getUnknownArgs(['tasks', 'copy', 'react']);
         const jestEnv = isBrowser ? 'jsdom' : 'node';
         const args = [
            unitsPath,
            '--jest',
            // Не выводить сообщения только локально. В Jenkins сообщения забирает jest-junit и кладет в xml.
            `--silent=${!isCI}`,
            `--config=${pathToConfig}`,
            `--env=${jestEnv}`,
            ...otherArguments
         ];
         // Чтобы отчет сохранялся средствами jest-junit
         if (this._report === 'xml') {
            // jest-junit xml file configuration
            args.push(`--ENV_VAR-JEST_JUNIT_OUTPUT_FILE=${outputFile}`);
            args.push(`--ENV_VAR-JEST_SUITE_NAME=Jest Unit Tests`);
            args.push(`--ENV_VAR-JEST_JUNIT_SUITE_NAME=${fullName}.{title}`);
            args.push(`--ENV_VAR-JEST_JUNIT_CLASSNAME=${fullName}.{classname}`);
            args.push(`--ENV_VAR-JEST_JUNIT_TITLE={title}`);
            args.push(`--ENV_VAR-JEST_JUNIT_INCLUDE_CONSOLE_OUTPUT=true`);
         }
         // Необходимо, чтобы jest не создавал снимки в случае их отсутствия
         if (isCI) {
            args.push('--ci');
         }

         if (isBrowser) {
            args.push(`--port=${port}`);
            args.push(`--root=${this.options.get('resources')}`);
         }

         await this._makeJestSnapshotResolver(config);
         await this._makeJestTestConfig(config);

         await this._shell.spawn(
            'node',
            args,
            {
               processName: fullName,
               timeout: TEST_TIMEOUT,
               silent: this._report === 'console',
               stdio: this._report === 'console' ? 'inherit' : 'pipe'
            }
         );

         // todo разобраться почему ошибки без стека, пока такие не учитываем
         this._testErrors[fullName] = this._shell.getErrorsByName(fullName);
         if (this._testErrors[fullName]) {
            this._testErrors[fullName] = this._testErrors[fullName].filter(msg => msg.includes('Stack:'));
         }
      } catch (e) {
         this._testErrors[fullName] = e;
      } finally {
         if (this._shouldUpdateAllowedErrors) {
            this._testErrors[fullName].map((msg) => {
               this._allowedErrorsSet.add(this._getErrorText(msg));
               return undefined;
            });
         }
      }
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
         const moduleName = `${name}`;
         const processName = moduleName + NODE_SUFFIX;
         if (this._shouldRunJestFramework(moduleName)) {
            return this._startJestTest(name, testModules, false);
         }
         try {
            const pathToConfig = _private.getPathToTestConfig(name, false);

            await this._makeTestConfig({
               name: name,
               testModules: testModules || name,
               path: pathToConfig,
               isBrowser: false
            });

            const unitsPath = require.resolve('saby-units/cli.js');
            const coverage = this.options.get('coverage') ? '--coverage' : '';
            const report = this._report === 'xml' ? '--report' : '';
            const otherArguments = this._getUnknownArgs(['tasks', 'report', 'coverage']);

            const args = [
               unitsPath,
               '--isolated',
               `--config=${pathToConfig}`,
               coverage,
               report,
               ...otherArguments
            ];

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

            // todo разобраться почему ошибки без стека, пока такие не учитываем
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
                  return undefined;
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
      const canRunBrowserTests = !this.options.get('node') && (
         (moduleCfg && moduleCfg.testInBrowser) || !moduleCfg || this._testOnlyBrowser
      );

      if (canRunBrowserTests) {
         const moduleName = `${name}`;

         if (this._shouldRunJestFramework(moduleName)) {
            return this._startJestTest(name, testModules, true);
         }

         const configPath = _private.getPathToTestConfig(name, true);
         const coverage = this.options.get('coverage') ? ' --coverage' : '';

         logger.log('Запуск тестов в браузере', name);

         await this._makeTestConfig({
            name: name,
            testModules: testModules || name,
            path: configPath,
            isBrowser: true
         });

         if (this.options.get('server')) {
            await Promise.all([
               this._executeBrowserTestCmd(
                  `node ${require.resolve('saby-units/cli/server.js')} --configUnits=${configPath}`,
                  name,
                  configPath,
                  0
               ),
               this._openBrowser(name)
            ]);
         } else {
            await this._executeBrowserTestCmd(
               `node ${require.resolve('saby-units/cli.js')} --browser${coverage} --report --configUnits=${configPath}`,
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
         this._restartCounter[moduleName] = this._restartCounter[moduleName] ? this._restartCounter[moduleName]++ : 1;
         await this._shell.execute(
            cmd,
            process.cwd(),
            {
               processName: `test browser ${moduleName}`,
               timeout: timeout
            }
         );
      } catch (errors) {
         if (errors.some(Test.includesEnvError) && this._restartCounter[moduleName] < MAX_TEST_RESTART) {
            this._restartCounter[moduleName]++;
            logger.log('Ошибка окружения, повторный запуск тестов', moduleName);
            await this._executeBrowserTestCmd(cmd, moduleName, configPath);
         } else {
            this._testErrors[moduleName + BROWSER_SUFFIX] = errors;
         }
      }
   }

   /**
    *
    * @param {String} error - Текст ошибки
    * @returns {Boolean}
    */
   static includesEnvError(error) {
      return error.includes('EADDRINUSE') || error.includes('ECHROMEDRIVER') || error.includes('Failed to fetch');
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

         logger.writeLogFile('testOrder.json', JSON.stringify(this.startedTests, null, 3));

         if (!this.options.get('server') && this._report === 'xml') {
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

      if (this.options.get('diff')) {
         for (const name of this.options.get('rep')) {
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
      const rc = this.options.get('rc');

      if (rc && branch !== rc) {
         this._diff.set(repName, await git.diff(branch, rc));
      }
   }

   /**
    * Возвращает текст ошибки без цифр и пробелов
    * @param {String} textАtslib
    * @private
    */
   // eslint-disable-next-line class-methods-use-this
   _getErrorText(text) {
      let firstRow = text.split('\n')[0];
      // eslint-disable-next-line no-useless-escape
      return firstRow.replace(/[\d\[\]]/g, '').replace(/\s{2,}/g, ' ').trim();
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

   _getUnknownArgs(ignoreArgs = []) {
      // FIXME: ignoreArgs нужен, чтобы Jest не ругался на неизвестные параметры.
      //  Выяснить, почему --tasks, --react, --copy остались необработанными и убрать фильтрацию.
      const args = [];

      for (const [name, value] of this.options) {
         if (ignoreArgs.includes(name)) {
            continue;
         }

         switch (typeof value) {
            case 'boolean': {
               args.push(`--${name}`);
               break;
            }
            case 'string': {
               args.push(`--${name}=${value.includes(' ') ? `"${value}"` : value}`);
               break;
            }
         }
      }

      return args;
   }
}

module.exports = Test;
