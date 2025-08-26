const pathUtils = require('../Utils/path');
const fs = require('fs-extra');
const Linter = require('./Linter');

const NAME_CONFIG = 'tailwind.config.js';

/**
 * Конфигурация для Tailwind.
 * @extends Linter
 * @class Tailwind
 */
class Tailwind extends Linter {
   /**
    * Конструктор конфигурации Tailwind.
    * @param TailwindModule {Module} Модуль Tailwind.
    */
   constructor(TailwindModule, root = process.cwd()) {
      super();

      this.name = 'Tailwind';
      this.source = pathUtils.join(TailwindModule.path, NAME_CONFIG);
      this.path = pathUtils.join(root, NAME_CONFIG);
      this.file = fs.readFileSync(this.source);
   }
}

module.exports = Tailwind;
