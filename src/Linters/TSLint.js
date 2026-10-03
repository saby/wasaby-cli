const pathUtils = require('../Utils/path');
const Linter = require('./Linter');

/**
 * Конфигурация для TSLint.
 * @extends Linter
 * @class TSLint
 */
class TSLint extends Linter {
   /**
    * Конструктор конфигурации TSLint.
    */
   constructor() {
      super();

      this.name = 'TSLint';
      this.path = pathUtils.join(process.cwd(), 'tslint.json');
      this.source = pathUtils.join(this.pathToConfigStore, 'stylelint', 'stylelint-config.json');
      this.file = JSON.stringify({
         extends: 'saby-typescript/tslint.json'
      }, null, 3);
   }
}

module.exports = TSLint;
