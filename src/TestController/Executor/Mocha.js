const fs = require('fs-extra');

const pathUtils = require('../../Utils/path');
const logger = require('../../Utils/Logger');
const xml = require('../../Utils/xml');
const Executor = require('./Executor');
const ChildProcess = require('../../Utils/ChildProcess');

const AVAILABLE_REPORT_FORMAT = ['json', 'html', 'text'];

class Mocha extends Executor {
   constructor(cfg) {
      super(cfg);

      this.name = 'Mocha';
      this.processName = `${this.processName}_Mocha`;
      this.environment = cfg.environment;
      this.configPath = pathUtils.join(cfg.resultPath, 'mochaConfig.json');

      const coverageDir = pathUtils.join(cfg.resultPath, 'coverage');
      const coverageReport = this.options.get('coverage');

      this.config = {
         moduleType: 'amd',
         patchedRequire: true,
         ignoreLeaks: true,
         root: cfg.root,
         tests: [],
         report: this.reportPath,
         htmlCoverageReport: pathUtils.join(coverageDir, 'index.html'),
         jsonCoverageReport: pathUtils.join(coverageDir, 'index.json'),
         nyc: {
            include: [],
            reportDir: coverageDir,
            cwd: cfg.root,
            report: AVAILABLE_REPORT_FORMAT.includes(coverageReport) ? coverageReport : 'html'
         }
      };

      if (this.options.get('isLocaleProject')) {
         for (const module of this.testedModules) {
            this.config.nyc.include.push(`${module.name}/**/*`);
         }
      }

      if (this.options.get('port')) {
         this.config.url = {
            port: this.options.get('port')
         };
      }

      this._readModules();
   }

   async run() {
      this.errors = [];

      await this.saveConfig();
      await this.cleanReportDir();

      switch (this.environment) {
         case 'JSDOM': {
            logger.info('Start unit testing in JSDOM', this.processName);

            await this.startBrowser();
            break;
         }
         case 'NodeJS': {
            logger.info('Start unit testing in Node.js', this.processName);

            await this.startNodeJs();
            break;
         }
         default: {
            break;
         }
      }

      logger.info('Recording report unit tests', this.processName);

      await this._checkReports();
      await this._prepareReport();
      await this._writeErrors();

      logger.info('Unit testing is end', this.processName);
   }

   async startNodeJs() {
      const executeProcess = new ChildProcess({
         type: 'spawn',
         exeFile: this.path,
         args: {
            configUnits: this.configPath,
            isolated: true,
            report: this.report === 'xml',
            coverage: !!this.options.get('coverage'),
            grep: this.options.get('grep')
         },
         silent: this.report === 'xml',
         processName: this.processName,
         timeout: this.timeout,
         onError: this.onError
      });

      try {
         await executeProcess.run();

         this.status = 'success';
      } catch (errors) {
         this.errors = errors;

         this.status = 'fail';

         return;
      }

      this.errors = executeProcess.errors;
   }

   async startBrowser() {
      if (this.options.get('server')) {
         return this.startServer();
      }

      const executeProcess = new ChildProcess({
         type: 'spawn',
         exeFile: this.path,
         args: {
            configUnits: this.configPath,
            browser: true,
            report: this.report === 'xml',
            coverage: !!this.options.get('coverage')
         },
         silent: this.report === 'xml',
         processName: this.processName,
         timeout: this.timeout,
         onError: this.onError
      });

      try {
         await executeProcess.run();

         this.status = 'success';
      } catch (errors) {
         this.errors = errors;

         this.status = 'fail';
      }
   }

   async startServer() {
      const executeProcess = new ChildProcess({
         type: 'spawn',
         exeFile: require.resolve('saby-units/cli/server.js'),
         args: {
            configUnits: this.configPath,
            openPage: true
         },
         processName: this.processName,
         timeout: this.timeout,
         onError: this.onError
      });

      try {
         await executeProcess.run();
      } catch (errors) {
         this.errors = errors;
      }
   }

   async saveConfig() {
      await fs.outputFile(
         this.configPath,
         JSON.stringify(this.config, null, 3)
      );
   }

   async _prepareReport() {
      if (this.report !== 'xml') {
         return;
      }

      let report = await xml.readXmlFile(this.reportPath);

      if (report.testsuite && report.testsuite.testcase) {
         for (const testcase of report.testsuite.testcase) {
            testcase.$.classname = `${this.processName}.${testcase.$.classname.replace(/\./g, ' ')}`;
         }
      } else {
         report = this._getReportTemplate();
      }

      await xml.writeXmlFile(this.reportPath, report);
   }

   _readModules() {
      let depsModules = [];

      for (const module of this.modules) {
         this.config.tests.push(module.name);

         depsModules = [...depsModules, ...module.depends];
      }

      for (const moduleName of (this.options.get('coveredModules') || depsModules)) {
         this.config.nyc.include.push(`${moduleName}/**/*.js`);
         this.config.nyc.include.push(`${moduleName}/**/*.jsx`);
      }
   }
}

module.exports = Mocha;
