const fs = require('fs-extra');
const glob = require('glob');
const pMap = require('p-map');

const Executor = require('./Executor');
const pathUtils = require('../../Utils/path');
const logger = require('../../Utils/Logger');

const WDIO_CONFIG_TEMPLATES = fs.readFileSync(pathUtils.join(__dirname, 'templates/wdioConfig.js'), 'utf-8');

function getUnitLibPath() {
   return pathUtils.normalize(require.resolve('saby-units/lib/ws/setup.js')).replace('/ws/setup.js', '');
}

/**
 * Исполнитель для тестов под WDIO.
 * @author Кудрявцев И.С.
 */
class WebDriverIO extends Executor {
   constructor(cfg) {
      super(cfg);

      this.name = 'WebDriverIO';
      this.environment = `Browser`;
      this.processName = `${this.processName}_WebDriverIO`;
      this.configPath = pathUtils.join(cfg.resultPath, 'wdio.config.js');
      this.reportPath = pathUtils.join(this.reportDir, 'result-tests.json');
      this.screenshotsDir = this.options.get('screenshotsDir');
      this.browserLogsDir = this.options.get('browserLogsDir') || pathUtils.join(this.reportDir, 'browserLogs');
      this.excludeTests = [];
      this.includeTests = [];

      this.config = {
         runner: 'local',

         baseUrl: this.options.get('baseUrl'),

         hostname: this.options.get('hostname'),
         port: this.options.get('driverPort'),
         path: this.options.get('path'),

         waitforTimeout: this.options.get('waitForTimeout') || 5000,
         maxInstances: this.options.get('maxInstances') || 1,

         specs: [],

         logLevel: this.options.get('logLevel') || 'error',

         capabilities: [{
            ...this.options.get('extCapabilities'),
            browserName: this.options.get('browserName') || 'chrome'
         }],

         mochaOpts: {
            timeout: 0
         },

         reporters: [
            [
               require.resolve('./Reporter/WDIOJSON'),
               {
                  outputDir: this.reportDir,
                  outputFileFormat: '/*#OUTPUT_FILE_FORMAT#*/',
                  screenshotsDir: this.screenshotsDir,
                  browserLogsDir: this.browserLogsDir,
                  testDir: this.root
               }
            ]
         ],

         services: [
            'devtools'
         ]
      };

      const mochaTimeout = this.options.get('mochaTimeout');

      if (mochaTimeout) {
         this.config.mochaOpts.timeout = mochaTimeout;
         this.config.connectionRetryTimeout = Math.floor(mochaTimeout * 0.9);
      }

      this._initReporters();
      this._readExclude();
      this._readInclude();

      this._readModules();
   }

   _initReporters() {
      if (this.report === 'xml') {
         this.config.reporters.push([
            'junit',
            {
               outputDir: pathUtils.join(this.reportDir, 'xml'),
               suiteNameFormat: '/*#SUITE_NAME_FORMAT#*/',
               outputFileFormat: '/*#OUTPUT_FILE_FORMAT_XML#*/'
            }
         ]);
      }
   }

   _readExclude() {
      if (this.options.get('exclude')) {
         this.excludeTests = this.options.get('exclude').tests;
         this.config.exclude = this.options.get('exclude').files.map(fileName => pathUtils.join(this.root, fileName));
      }
   }

   _readInclude() {
      if (this.options.has('testNamePattern')) {
         this.testNamePattern = `/${this.options.get('testNamePattern')}/`;
      }

      if (this.options.get('onlyFailed') && fs.existsSync(this.reportPath)) {
         const report = fs.readJSONSync(this.reportPath);

         this.includeTests = report.failedTestsNames;
      }
   }

   _readModules() {
      if (this.options.has('testPathPattern')) {
         this.config.specs.push(pathUtils.join(this.root, `${this.options.get('testPathPattern')}**`));

         return;
      }

      for (const module of this.modules) {
         this.config.specs.push(pathUtils.join(this.root, `${module.name}/**/*.test.js`));
      }
   }

   _prepareScreenshoter(config) {
      if (this.screenshotsDir) {
         fs.ensureDirSync(this.screenshotsDir);
         return config
            .replace('/*#SCREENSHOT_ENABLE#*/', 'true')
            .replace('/*#SCREENSHOTS_DIR#*/', pathUtils.relative(process.cwd(), this.screenshotsDir));
      }
      return config.replace('/*#SCREENSHOT_ENABLE#*/', 'false');
   }

   _prepareBrowserLogger(config) {
      fs.ensureDirSync(this.browserLogsDir);

      return config.replace('/*#BROWSER_LOGS_DIR#*/', this.browserLogsDir);
   }

   /**
    * Подгатавливает и записывает конфиг для WDIO.
    * @returns {Promise<void>}
    */
   async saveConfig() {
      const config = this._prepareScreenshoter(this._prepareBrowserLogger(WDIO_CONFIG_TEMPLATES))
         .replace('/*#MAIN_CONFIG#*/', JSON.stringify(this.config, null, 3).slice(1, -1))
         .replace('"/*#SUITE_NAME_FORMAT#*/"', '/[^a-zA-Zа-яА-Я0-9:@]+/')
         .replace('/*#TEST_NAME_PATTERN#*/', this.testNamePattern)
         /* eslint-disable no-template-curly-in-string */
         .replace('"/*#OUTPUT_FILE_FORMAT#*/"', '(opts)=>`wdio-${opts.cid}.json`')
         .replace('"/*#OUTPUT_FILE_FORMAT_XML#*/"', '(opts)=>`wdio-${opts.cid}.xml`')
         /* eslint-enable no-template-curly-in-string */
         .replace('/*#EXCLUDE_TESTS#*/', JSON.stringify(this.excludeTests).slice(1, -1))
         .replace('/*#INCLUDE_TESTS#*/', JSON.stringify(this.includeTests).slice(1, -1))
         .replace(/\/\*#UNITS_LIB_PATH#\*\//g, getUnitLibPath())
         .replace(/\/\*#RESOURCE_ROOT#\*\//g, `'${this.root}'`);

      await fs.outputFile(this.configPath, config);
   }

   /**
    * Запускает тесты под WDIO.
    * @param options {Object} Опция для запуска тестов.
    * @returns {Promise<void>}
    */
   async run(options) {
      if (!this.config.baseUrl) {
         this.config.baseUrl = `http://localhost:${options.port}/DemoStand/app/`;
      }

      await this.cleanReportDir();
      await this.saveConfig();

      logger.info('Start testing in Browser', this.processName);

      try {
         await this.cmd.spawn(
            {
               file: require.resolve('@wdio/cli/bin/wdio.js'),
               command: 'run',
               args: {
                  'opt#1': this.configPath
               },
               assignmentOperator: ' '
            },
            {
               processName: this.processName,
               timeout: this.timeout,
               stdio: [process.stdin, 'pipe', 'pipe']
            }
         );
      } catch (err) {
         logger.debug(err);
      }

      logger.info('Merging test reports in Browser', this.processName);

      await this.mergeReport();

      logger.info('Browser testing is end', this.processName);
   }

   /**
    * Смерживает сгенеренные отчёты. WDIO генерирует отчёт на каждый файл, функция мержит их в один.
    * @returns {Promise<void>}
    */
   async mergeReport() {
      const result = {
         capabilities: [],
         suites: [],
         specs: [],
         failedTestsNames: [],
         state: {
            passed: 0,
            failed: 0,
            skipped: 0
         },
         baseUrl: this.config.baseUrl,
         framework: 'mocha'
      };

      await pMap(glob.sync(pathUtils.join(this.reportDir, '/wdio-*.json')), async(reportPath) => {
         const report = await fs.readJSON(reportPath);

         for (const suite of report.suites) {
            result.suites.push(suite);
            result.end = result.end ? (suite.end > result.end ? suite.end : result.end) : suite.end;
            result.start = result.start ? (suite.start < result.start ? suite.start : result.start) : suite.start;
         }

         result.capabilities.push(report.capabilities);
         result.specs = [...result.specs, ...report.specs];
         result.failedTestsNames = [...result.failedTestsNames, ...report.failedTestsNames];
         result.state.passed += report.state.passed;
         result.state.failed += report.state.failed;
         result.state.skipped += report.state.skipped;

         await fs.remove(reportPath);
      }, {
         concurrency: 10
      });

      await fs.outputFile(this.reportPath, JSON.stringify(result, null, 3));
   }
}

module.exports = WebDriverIO;
