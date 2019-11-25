const fs = require('fs-extra');
const path = require('path');
const pMap = require('p-map');
const logger = require('./util/logger');
const ModulesMap = require('./util/modulesMap');
const xml = require('./util/xml');
const Base = require('./base');

const BROWSER_SUFFIX = '_browser';
const NODE_SUFFIX = '_node';
const PARALLEL_TEST_COUNT = 1;

let getReportTemplate = () => {
   return {
      testsuite: {
         $: {
            errors: '1',
            failures: '1',
            name: 'Mocha Tests',
            tests: '1'
         },
         testcase: []
      }
   };
};

let getErrorTestCase = (name, details) => {
   return {
      $: {
         classname: `[${name}]: Test runtime error`,
         name: 'Some test has not been run, see details',
         time: '0'
      },
      failure: details
   };
};

class Test extends Base {
   constructor(cfg) {
      super(cfg);
      this._testReports = new Map();
      this._resources = cfg.resources;
      this._ports = cfg.ports;
      this._reposConfig = cfg.reposConfig;
      this._workspace = cfg.workspace || cfg.workDir;
      this._testErrors = {};
      this._server = cfg.server;
      this._modulesMap = new ModulesMap({
         reposConfig: cfg.reposConfig,
         store: cfg.store,
         testRep: cfg.testRep,
         workDir: cfg.workDir,
         only: cfg.only
      });
   }

   /**
    * Дописывает в отчеты название репозитория
    */
   async prepareReport() {
      let promisArray = [];

      logger.log('Подготовка отчетов');
      this._testReports.forEach((filePath, name) => {
         if (fs.existsSync(filePath)) {
            let errorText = '';
            if (this._testErrors[name]) {
               errorText = this._testErrors[name].join('<br/>');
            }
            let readPromise = xml.readXmlFile(filePath).then((result) => {
               if (result.testsuite && result.testsuite.testcase) {
                  result.testsuite.testcase.forEach((item) => {
                     item.$.classname = `[${name}]: ${item.$.classname}`;
                  });
               } else {
                  result = {
                     testsuite: {
                        testcase: []
                     }
                  };
               }

               if (errorText) {
                  result.testsuite.testcase.push(getErrorTestCase(name, errorText));
               }

               xml.writeXmlFile(filePath, result);
            }).catch(error => {
               logger.log(error);
            });

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
            this._createReport(pathToReport);
         }
      });
      if (error.length > 0) {
         logger.log(`Сгенерированы отчеты с ошибками: ${error.join(', ')}`);
      }
      logger.log('Проверка пройдена успешно');
   }

   _createReport(pathToFile) {
      xml.writeXmlFile(pathToFile, getReportTemplate());
   }

   _getTestConfig(name, suffix) {
      const testConfig = require('../testConfig.base.json');
      let cfg = {...testConfig};
      let fullName = name + (suffix || '');
      let workspace = path.relative(process.cwd(), this._workspace);
      cfg.url = {...cfg.url};
      cfg.tests = this._modulesMap.getTestModules(name);
      cfg.root =  path.relative(process.cwd(), this._resources);
      cfg.htmlCoverageReport = cfg.htmlCoverageReport.replace('${module}', fullName).replace('${workspace}', workspace);
      cfg.jsonCoverageReport = cfg.jsonCoverageReport.replace('${module}', fullName).replace('${workspace}', workspace);
      cfg.report = cfg.report.replace('${module}', fullName).replace('${workspace}', workspace);
      this._testReports.set(fullName, cfg.report);
      return cfg;
   }

   /**
    * Создает конфиги для юнит тестов
    * @return {Promise<[any, ...]>}
    * @private
    */
   _makeTestConfig() {
      const configPorts = this._ports ? this._ports.split(',') : [];
      const promiseArray = [];
      let port = 10025;
      for (const name of this._modulesMap.getTestList()) {
         promiseArray.push(new Promise(resolve => {
            const nodeCfg = this._getTestConfig(name, NODE_SUFFIX);
            fs.outputFileSync(
               this._getPathToTestConfig(name, false),
               JSON.stringify(nodeCfg, null, 4)
            );
            if (this._reposConfig[name].unitInBrowser) {
               const browserCfg = this._getTestConfig(name, BROWSER_SUFFIX);
               browserCfg.url.port = configPorts.shift() || port++;
               fs.outputFileSync(
                  this._getPathToTestConfig(name, true),
                  JSON.stringify(browserCfg, null, 4)
               );
            }
            resolve();
         }));
      }
      return Promise.all(promiseArray);
   }

   async _startNodeTest(name) {
      try {
         if (!this._server) {
            const configPath = this._getPathToTestConfig(name, false);
            await this._shell.execute(
               `node node_modules/saby-units/cli.js --isolated --report --config=${configPath}`,
               process.cwd(),
               `test node ${name}`
            );
         }
      } catch (e) {
         this._testErrors[name + NODE_SUFFIX] = e;
      }
   }

   /**
    * запускает тесты в браузере
    * @param {String} name - название репозитория в конфиге
    * @return {Promise<void>}
    * @private
    */
   async _startBrowserTest(name) {
      let cfg = this._reposConfig[name];
      if (cfg.unitInBrowser) {
         logger.log('Запуск тестов в браузере', name);
         try {
            const configPath = this._getPathToTestConfig(name, true);
            let cmd = '';
            if (this._server) {
               cmd = `node node_modules/saby-units/cli/server.js --config=${configPath}`;
            } else {
               cmd = `node node_modules/saby-units/cli.js --selenium --browser --report --config=${configPath}`;
            }
            await this._shell.execute(
               cmd,
               process.cwd(),
               `test browser ${name}`
            );
         } catch (e) {
            this._testErrors[name + BROWSER_SUFFIX] = e;
         }
         logger.log('тесты в браузере завершены', name);
      }
   }

   /**
    * Запускает тестирование
    * @return {Promise<void>}
    */
   async _run() {
      try {
         logger.log('Запуск тестов');
         await this._modulesMap.build();
         await this._makeTestConfig();
         await pMap(this._modulesMap.getTestList(), (name) => {
            logger.log('Запуск тестов', name);
            return Promise.all([
               this._startNodeTest(name),
               this._startBrowserTest(name)
            ]);
         }, {
            concurrency: PARALLEL_TEST_COUNT
         });
         await this.checkReport();
         await this.prepareReport();
         logger.log('Тестирование завершено');
      } catch (e) {
         throw e;
         throw new Error(`Тестирование завершено с ошибкой ${e}`);
      }
   }

   _getPathToTestConfig(name, isBrowser) {
      const browser = isBrowser ? '_browser' : '';
      return path.relative(
         process.cwd(),
         path.normalize(path.join( __dirname, '..', `testConfig_${name}${browser}.json`))
      );
   }

}

module.exports = Test;
