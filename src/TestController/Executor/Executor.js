const fs = require('fs-extra');

const pathUtils = require('../../Utils/path');
const xml = require('../../Utils/xml');
const logger = require('../../Utils/Logger');

const ALLOWED_ERRORS = require('./allowedErrors.json');
const EXECUTOR_PATH = require.resolve('saby-units/cli.js');

/**
 * Возвращает шаблон тескейса c ошибкой для xml
 * @param {String} testName Название теста
 * @param {String} details Детализация ошибки
 * @returns {{$: {classname: string, name: string, time: string}, failure: *}}
 */
function getErrorTestCase(testName, details) {
   return {
      $: {
         classname: `[${testName}]: Test runtime error`,
         name: 'Some test has not been run, see details',
         time: '0'
      },
      failure: details.replace(/\x1b[[\d]+m/g, '')
   };
}

function onError(error, result, errors) {
   const err = error.replace(/\s{2,}/g, ' ').trim();

   // TODO Дырявая ширма, которая прикрывает проблемы фильтровать с ошибками в консоле.
   //  Так как node.js копить ошибки в буфере и отдает чанки в stderr, и, если в чанке есть warning, то это не ошибка.
   //  В результате происходят не стабильные падения юнитов из-за ошибок в консоле, потому что им не повезло
   //  и в чанка не попался warning. Решение лишь одно нужно вычишять все консольные логи.
   if (/warning/i.test(err)) {
      return;
   }

   if (err.includes('Stack:') && !ALLOWED_ERRORS.some(text => err.includes(text))) {
      errors.push(error);

      return;
   }

   if (err.includes('has been terminated by timeout. Timeout:')) {
      errors.push(`${error}. Debug logs can be found by path ${logger.debugLogsPath}`);
   }
}

class Executor {
   constructor(cfg) {
      this.options = cfg.options;
      this.errors = [];
      this.path = EXECUTOR_PATH;
      this.modules = cfg.modules;
      this.testedModules = cfg.testedModules;
      this.root = cfg.root;

      this.timeout = (this.options.get('timeoutTests') || 0) * 1000;
      this.report = this.options.get('report') || 'xml';
      this.processName = cfg.processName;

      this.reportPath = pathUtils.join(cfg.resultPath, 'result', 'xunit-report.xml');
      this.reportDir = pathUtils.dirname(this.reportPath);

      if (!this.options.get('disableConsoleFilter')) {
         this.onError = onError;
      }
   }

   async _checkReports() {
      if (this.report === 'xml' && !fs.pathExistsSync(this.reportPath)) {
         this.errors.push(`Not was created report. Debug logs can be found by path ${logger.debugLogsPath}`);

         await xml.writeXmlFile(this.reportPath, this._getReportTemplate());
      }
   }

   async _writeErrors() {
      if (this.report !== 'xml') {
         for (const error of this.errors) {
            logger.error(error);
         }

         return;
      }

      if (this.errors.length !== 0) {
         const report = await xml.readXmlFile(this.reportPath);

         if (!report.testsuite.testcase) {
            report.testsuite.testcase = [];
         }

         report.testsuite.testcase.push(getErrorTestCase(this.processName, this.errors.join('\n')));

         await xml.writeXmlFile(this.reportPath, report);
      }
   }

   /**
    * Возвращает шаблон xml файла
    * @returns {{testsuite: {$: {failures: string, tests: string, name: string, errors: string}, testcase: []}}}
    */
   _getReportTemplate() {
      return {
         testsuite: {
            $: {
               errors: '0',
               failures: '0',
               name: 'Unit Tests',
               tests: '1'
            },
            testcase: []
         }
      };
   }

   async cleanReportDir() {
      await fs.remove(this.reportDir);
   }
}

module.exports = Executor;
