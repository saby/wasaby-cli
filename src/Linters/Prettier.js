const pathUtils = require('../Utils/path');
const Linter = require('./Linter');
const PrettierIgnore = require('./PrettierIgnore');

/**
 * Конфигурация для Prettier.
 * @extends Linter
 * @class Prettier
 */
class Prettier extends Linter {
   /**
    * Конструктор конфигурации Prettier.
    * @param ignorePaths {String[]} Список путей, которые должны игнорироваться.
    */
   constructor(ignorePaths, root = process.cwd()) {
      super();

      this.ignore = new PrettierIgnore(ignorePaths, root);
      this.name = 'Prettier';
      this.namePackage = 'prettier';
      this.path = pathUtils.join(root, '.prettierrc.js');
      const sourceConfig = require(pathUtils.join(this.pathToConfigStore, 'prettier', 'prettier-config.json'));
      this.config = {
         ...sourceConfig
      };
      this.extensions = [
         'js',
         'ts',
         'jsx',
         'tsx',
         'css',
         'less'
      ];

      this.commandFlags = `--no-editorconfig --config ${this.path} --ignore-path ${this.ignore.path} --check`;
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

module.exports = Prettier;
