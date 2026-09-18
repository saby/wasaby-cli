const pathUtils = require('../Utils/path');
const fs = require('fs-extra');
const Linter = require('./Linter');
const logger = require('../Utils/Logger');

const CONFIG_FILE_NAMES = [
   'tailwind.preset.js',
   'tailwind.config.js',
];

/**
 * Конфигурация для Tailwind.
 * @extends Linter
 * @class Tailwind
 */
class Tailwind extends Linter {
   /**
    * Конструктор конфигурации Tailwind.
    * @param {Module} TailwindModule Модуль Tailwind.
    * @param {string} root Путь до корневой директории
    */
   constructor(TailwindModule, root = process.cwd()) {
      super();

      this.name = 'Tailwind';
      this.source = TailwindModule.path;
      this.path = root;
   }

   /**
    * Записывает конфигурационный файл по указанному пути.
    * @returns {Promise<void>}
    */
   async init() {
      for await (const fileName of CONFIG_FILE_NAMES) {
         try {
            logger.info(`Creating ${fileName} configuration.`);

            await fs.copyFile(pathUtils.join(this.source, fileName), pathUtils.join(this.path, fileName));
         } catch (err) {
            logger.error(`Error creating ${fileName} config from ${this.source} to ${this.path}:  ${err}`);
         }
      }
   }
}

module.exports = Tailwind;
