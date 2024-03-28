const pathUtils = require('../Utils/path');
const Linter = require('./Linter');
const StylelintIgnore = require('./StylelintIgnore');

/**
 * Конфигурация для Stylelint.
 * @extends Linter
 * @class Stylelint
 */
class Stylelint extends Linter {
   /**
    * Конструктор конфигурации Stylelint.
    *
    * @param ignorePaths {String[]} Список путей, которые должны игнорироваться.
    */
   constructor(ignorePaths) {
      super();

      this.ignore = new StylelintIgnore(ignorePaths);
      this.name = 'Stylelint';
      this.namePackage = 'stylelint';
      this.path = pathUtils.join(process.cwd(), '.stylelintrc.js');
      this.source = pathUtils.join(this.pathToConfigStore, 'stylelint', 'stylelint-config.json');
      this.config = {
         extends: this.source
      };
      this.extensions = [
         'css',
         'less'
      ];

      this.commandFlags = `--config ${this.path} --ignore-path ${this.ignore.path}`;
   }

   /**
    * Записывает конфигурационный файл и файл с игнорируемыми путями по указанному пути.
    * @returns {Promise<void>}
    */
   async init() {
      await Promise.all([
         super.init(),
         this.ignore.init()
      ]);
   }
}

module.exports = Stylelint;
