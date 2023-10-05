const fs = require('fs-extra');

const pathUtils = require('../../../Utils/path');
const Executor = require('../Executor');
const logger = require('../../../Utils/Logger');
const NodeJS = require('./../../../Process/NodeJS');

const getProcessArguments = require('./command');
const { getWebStormArguments } = require('./ide');
const createJestConfiguration = require('./config');
const generateSnapshotResolverSource = require('./snapshotsResolver');

// TODO Jest на 16-ом Node.js текут воркеры и выжирают всю память на тачке отправляя её в обморок.
//  Пришлось ограничить потребления памяти через опцию node-ы, но это привело к увеличению времени прохождения тестов.
//  Поэтому поднимаем таймаут до 10 минут.
//  https://github.com/facebook/jest/issues/11956
const TIMEOUT_PER_PROJECT = 600_000;
const TIMEOUT_PER_PROJECT_COVERAGE = 3_600_000;
const JEST_PATH = pathUtils.normalize(require.resolve('jest/bin/jest'));

class Jest extends Executor {
   constructor(cfg) {
      super(cfg);

      this.name = 'Jest';
      this.processName = `${this.processName}_jest`;
      this.environment = this.name;
      this.cacheDir = cfg.cacheDir;
      this.timeout = this._getProcessTimeout();

      this.jestConfigPath = pathUtils.join(cfg.resultPath, 'jestConfig.json');
      this.snapshotResolverPath = pathUtils.join(cfg.resultPath, 'snapshot-resolver.js');
   }

   async run({ staticServerPort } = { }) {
      this.staticServerPort = staticServerPort;

      this.prepareConfig();
      await this.saveConfig();
      await this.cleanReportDir();

      logger.info('Start unit testing under JEST', this.processName);
      await this.startNodeJS();

      logger.info('Recording report unit tests', this.processName);

      await this._checkReports();
      await this._writeErrors();

      logger.info('Unit testing is end', this.processName);
   }

   async startNodeJS() {
      let status = {
         not_passed: [],
         passed: [],
         skipped: []
      };
      const args = this._getProcessArguments();

      const executeProcess = new NodeJS({
         type: 'fork',
         exeFile: JEST_PATH,
         params: args.params,
         options: args.options,
         envArgs: {

            // FIXME: Limit memory usage because jest community (and we) faced with problem on node v16
            //  https://github.com/facebook/jest/issues/11956
            'optimize-for-size': true,
            'max-old-space-size': 8192,
            'expose-gc': true,
         },
         procOptions: this._getProcessOptions(),
         processName: this.processName,
         timeout: this.timeout,
         silent: this.report === 'xml',
         onError: this.onError,
         onMessage: (testStatus) => {
            status.not_passed = [...status.not_passed, ...testStatus.fail];
            status.passed = [...status.passed, ...testStatus.done];
            status.skipped = [...status.skipped, ...testStatus.skip];
         }
      });

      try {
         await executeProcess.run();

         this.status = 'success';
      } catch (errors) {
         this.errors = [...this.errors, ...errors];
         this.status = 'fail';
      } finally {
         await fs.outputFile(
            pathUtils.join(this.options.get('artifactsDir'), 'testsStatus', `${this.processName}.json`),
            JSON.stringify(status, null, 3)
         );

         this.errors = [...this.errors, ...executeProcess.errors];
      }
   }

   prepareConfig() {
      this.jestConfig = createJestConfiguration(this);
      this.snapshotResolverSource = generateSnapshotResolverSource(this.root, this.modules);
   }

   saveConfig() {
      return Promise.all([
         this._saveJestConfig(),

         // TODO Можно вызвать один раз, но только переда запуском всех тестов, когда уже известны все юниты для jesta.
         this._saveSnapshotResolver()
      ]);
   }

   _getProcessOptions() {
      const defaultOptions = {
         env: {
            ...process.env,
            COLORS: this.report !== 'xml'
         },
         cwd: this.root
      };

      if (this.options.has('ide')) {
         // Тесты запускаются через IDE.
         const ide = this.options.get('ide');

         if (ide === 'WebStorm') {
            // Тесты запускаются через WebStorm IDE.
            // Необходимо задать явно stdio, потому что через него IDE общается с jest.
            return {
               ...defaultOptions,
               stdio: 'inherit'
            };
         }
      }

      return defaultOptions;
   }

   _getProcessArguments() {
      const defaultOptions = {
         'config': this.jestConfigPath,
         'forceExit': true,
         'logHeapUsage': true
      };

      if (this.options.has('ide')) {
         // Тесты запускаются через IDE.
         // Аргументы запуска jest необходимо получить из process.argv,
         // в которых содержатся reporters и runTestsByPath.
         const ide = this.options.get('ide');

         if (ide === 'WebStorm') {
            const argv = getWebStormArguments(process.argv.slice(3), this.modules, this.root);

            return {
               options: {
                  ...defaultOptions,
                  ...argv.options
               },
               params: argv.params
            };
         }

         logger.error(`Получено неизвестное значение опции ide=${this.options.get('ide')}. Поддерживается: WebStorm.`);
      }

      return {
         options: {
            ...defaultOptions,
            ...getProcessArguments(this.options),
            silent: this.report === 'xml'
         }
      };
   }

   _getProcessTimeout() {
      if (this.options.get('isLocaleProject')) {
         return 0;
      }

      if (this.options.get('coverage')) {
         return TIMEOUT_PER_PROJECT_COVERAGE;
      }

      return TIMEOUT_PER_PROJECT;
   }

   _saveJestConfig() {
      return fs.outputFile(
         this.jestConfigPath,
         JSON.stringify(this.jestConfig, null, 3)
      );
   }

   _saveSnapshotResolver() {
      return fs.outputFile(
         this.snapshotResolverPath,
         this.snapshotResolverSource
      );
   }
}

module.exports = Jest;
