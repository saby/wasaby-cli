const pathUtils = require('../Utils/path');
const Linter = require('./Linter');

/**
 * Конфигурация для ESLinter.
 * @extends Linter
 * @class ESLint
 */
class ESLint extends Linter {
   /**
    * Конструктор конфигурации ESLinter.
    * @param tsconfigPath {String} Путь до tsconfig.json
    * @param ignorePaths {String[]} Список путей, которые должны игнорироваться.
    */
   constructor(tsconfigPath, ignorePaths) {
      super();

      this.name = 'ESLint';
      this.namePackage = 'eslint';
      this.path = pathUtils.join(process.cwd(), '.eslintrc.js');
      this.source = pathUtils.join(this.pathToConfigStore, 'eslint', 'base.js');

      const ignorePatterns = ignorePaths.map(path => `${path.replace(pathUtils.dirname(this.path), '')}/`);

      ignorePatterns.push('.eslintrc.js');

      this.config = {
         ignorePatterns,
         extends: [
            this.source
         ],
         parserOptions: {
            project: tsconfigPath
         }
      };
      this.extensions = [
         'ts',
         'js',
         'tsx',
         'jsx'
      ];

      this.commandFlags = `--quiet --no-eslintrc --no-color --config ${this.path}`;
   }
}

module.exports = ESLint;
