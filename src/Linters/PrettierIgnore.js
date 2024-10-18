const pathUtils = require('../Utils/path');
const Linter = require('./Linter');

/**
 * Конфигурация для файла с игнорируемыми путями для Prettier.
 * @extends Linter
 * @class PrettierIgnore
 */
class PrettierIgnore extends Linter {
   /**
    * Конструктор конфигурации с игнорируемыми путями.
    * @param ignorePaths {String[]} Список путей, которые должны игнорироваться.
    */
   constructor(ignorePaths, root = process.cwd()) {
      super();

      this.path = pathUtils.join(root, '.prettierignore');
      this.name = 'PrettierIgnore';

      const dir = pathUtils.dirname(this.path);
      const ignoreFiles = [
         '/node_modules/',
         '*.json',
         '*.md',
         '*.html',
         '*.min.js',
         '.clang-format',
         '.prettierrc.js',
         '.eslintrc.js',
         '.stylelintrc.js',
         'tailwind.config.js'
      ];

      for (const path of ignorePaths) {
         ignoreFiles.push(`${path.replace(dir, '')}/`);
      }

      this.file = ignoreFiles.join('\n');
   }
}

module.exports = PrettierIgnore;
