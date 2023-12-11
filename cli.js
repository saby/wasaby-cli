#!/usr/bin/env node

const fs = require('fs-extra');

const logger = require('./src/Utils/Logger');
const Config = require('./src/Utils/Config');
const Project = require('./src/Entities/Project');
const pathUtils = require('./src/Utils/path');
const Repository = require('./src/Entities/Repository');
const NodeJS = require('./src/Process/NodeJS');

const ERROR_CODE = 2;
const INFO_MESSAGE = 'See the list of commands in the readme. https://github.com/saby/wasaby-cli#readme';

/**
 * Модуль для запуска юнит тестов
 * @class Cli
 * @author Кудрявцев И.С.
 */

class Cli {
   constructor() {
      // TODO С 15-й версии Node.js --unhandled-rejections по умолчанию throw и наши юнит-тесты не проходят.
      //  Надо сделать, чтобы была опция строгого режима, которая будет выставлять throw.
      //  https://online.sbis.ru/opendoc.html?guid=83d02cb1-e300-4963-9d63-d5ee9de74d32
      process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS || ''} --unhandled-rejections=warn`;

      this.config = new Config();
      this.command = '';
      this.consoleArgs = process.argv.slice(2);

      this.config.read(this.consoleArgs);
      this.detectCommand();

      // Параметр, чтобы не терялись цвета в сообщения из child_process.
      if (this.config.params.get('isLocaleProject')) {
         process.env.FORCE_COLOR = true;
      }
   }

   async startScript(name, project) {
      const scriptPath = `${__dirname}/cli/${name}.js`;

      if (!fs.pathExistsSync(scriptPath)) {
         throw new Error(`Command "${name}" is not supported. ${INFO_MESSAGE}`);
      }

      const script = require(scriptPath);

      console.log(`Running "${name}" script`);

      try {
         await script(this.config, project);
      } catch (err) {
         const error = new Error(`Script "${name}" exited with errors.\n ${err}`);
         error.exitCode = err.exitCode;
         throw error;
      }

      console.log(`Script "${name}" completed successfully.`);
   }

   /**
    * Запускает сборку юнит тестов
    * @return {Promise<void>}
    */
   async run() {
      await logger.open({
         dir: pathUtils.join(this.config.params.get('artifactsDir'), this.command),
         enableLabels: !this.config.params.get('isLocaleProject'),
         console: {
            level: this.config.params.get('consoleLevel')
         }
      });

      await NodeJS.checkSupport();

      logger.info('Running Wasaby-cli');

      if (!this.command) {
         throw new Error(`Command was not specified. ${INFO_MESSAGE}`);
      }

      await this.config.prepareRepositories();
      const config = {
         options: this.config.params,
         repository: {}
      };

      if (this.config.params.get('isLocaleProject')) {
         config.repository = new Repository(await Repository.getInfo(process.cwd()));
      }

      const project = new Project(config);

      if (this.config.params.get('isLocaleProject') && this.command !== 'updateGitignore') {
         await this.startScript('updateGitignore', project);
      }

      await this.startScript(this.command, project);
   }

   detectCommand() {
      if (!this.consoleArgs[0].startsWith('--')) {
         this.command = this.consoleArgs[0];
         this.consoleArgs[0] = this.consoleArgs.slice(1);
      }
   }
}

module.exports = Cli;

process.on('exit', () => {
   logger.close();
});

// eslint-disable-next-line id-match
if (require.main.filename === __filename) {
   // Если файл запущен напрямую запускаем run
   const cli = new Cli();

   cli.run().then(() => {
      console.log('Finishing Wasaby-cli');
   }, (error) => {
      if (error instanceof Error) {
         console.error(error);
      } else {
         console.error(error.message);
      }
      process.exit(error.exitCode || ERROR_CODE);
   });
}
