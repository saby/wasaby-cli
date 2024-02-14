const pathUtils = require('../Utils/path');
const Linter = require('./Linter');

/**
 * Конфигурация для файла с игнорируемыми путями для Stylelint.
 * @extends Linter
 * @class StylelintIgnore
 */
class StylelintIgnore extends Linter {
   /**
    * Конструктор конфигурации с игнорируемыми путями.
    * @param ignorePaths {String[]} Список путей, которые должны игнорироваться.
    */
   constructor(ignorePaths) {
      super();

      this.path = pathUtils.join(process.cwd(), '.stylelintignore');
      this.name = 'StylelintIgnore';

      const dir = pathUtils.dirname(this.path);
      const ignoreFiles = [
         '/node_modules/'
      ];

      for (const path of ignorePaths) {
         ignoreFiles.push(`${path.replace(dir, '')}/`);
      }

      this.file = ignoreFiles.join('\n');
   }
}

module.exports = StylelintIgnore;
