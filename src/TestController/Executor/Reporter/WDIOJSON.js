const WDIOReporter = require('@wdio/reporter').default;
const crypto = require('crypto');
const pathUtils = require('../../../Utils/path');

function initResultSet(runner) {
   return {
      start: runner.start,
      end: runner.end,
      capabilities: runner.capabilities,
      host: runner.config.hostname,
      port: runner.config.port,
      baseUrl: runner.config.baseUrl,
      waitForTimeout: runner.config.waitForTimeout,
      framework: runner.config.framework,
      mochaOpts: runner.config.mochaOpts,
      suites: [],
      specs: [],
      failedTestsNames: [],
      state: {
         passed: 0,
         failed: 0,
         skipped: 0
      }
   };
}

/**
 * Отчёт в формате json для тестов под WDIO.
 * @author Кудрявцев И.С.
 */
class WDIOJSON extends WDIOReporter {
   constructor(options) {
      super(Object.assign(options));

      this.screenshotsDir = options.screenshotsDir;
      this.browserLogsDir = options.browserLogsDir;
      this.testDir = `${options.testDir}/`;
   }

   /**
    * Обрабатывает рекурсивно testsuite, выпрямляя их в плоский список и дописывая информацию для упавших тестов.
    * @param suite {Object} - информация о testsuite.
    * @param result {Set<Number>} - список идентификаторов обработанных testsuite-ов
    * @param resultSet {Object} - json отчёт.
    */
   readSuite(suite, result, resultSet) {
      result.add(suite.uid);

      suite.file = pathUtils.normalize(suite.file).replace(this.testDir, '');

      resultSet.state.failed += suite.hooks.filter(hook => hook.error).length;

      const filteredTests = [];

      for (const test of suite.tests) {
         const id = crypto.createHash('md5').update(test.fullTitle).digest('hex');

         test.browserLogs = `${this.browserLogsDir}/${id}.json`;

         switch (test.state) {
            case 'skipped': {
               resultSet.state.skipped++;
               filteredTests.push(test);

               break;
            }
            case 'failed': {
               resultSet.state.failed++;
               resultSet.failedTestsNames.push(test.fullTitle);

               if (this.screenshotsDir) {
                  test.screenshot = `${this.screenshotsDir}/${id}.png`;
               }

               filteredTests.push(test);

               break;
            }
            default: {
               resultSet.state.passed++;
               filteredTests.push(test);
            }
         }
      }

      suite.tests = filteredTests;

      for (const childSuite of suite.suites) {
         this.readSuite(childSuite, result, resultSet);
      }
   }

   /**
    * Обработчик события, когда процесс тестирования завершился. Записывает отчёт.
    * @param runner {RunnerStats} Отчёт от Mocha.
    */
   onRunnerEnd(runner) {
      this.write(JSON.stringify(this.prepareJson(runner)));
   }

   /**
    * Подготавливает отчёт перед записью.
    * @param runner {RunnerStats} Отчёт от Mocha.
    * @returns {Object}
    */
   prepareJson(runner) {
      const resultSet = initResultSet(runner);

      for (let specId of Object.keys(runner.specs)) {
         resultSet.specs.push(runner.specs[specId]);
         const checkedSuites = new Set();

         for (const [uid, suite] of Object.entries(this.suites)) {
            if (checkedSuites.has(uid)) {
               continue;
            }

            this.readSuite(suite, checkedSuites, resultSet);

            resultSet.suites.push(suite);
         }
      }

      return resultSet;
   }
}

exports.default = WDIOJSON;
