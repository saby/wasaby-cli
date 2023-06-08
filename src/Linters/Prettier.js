const pathUtils = require('../Utils/path');
const Base = require('./Base');
const PrettierIgnore = require('./PrettierIgnore');

class Prettier extends Base {
   constructor(ignorePaths) {
      super();

      this.ignore = new PrettierIgnore(ignorePaths);
      this.name = 'Prettier';
      this.namePackage = 'prettier';
      this.path = pathUtils.join(process.cwd(), '.prettierrc.js');
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

   async init() {
      await Promise.all([
         super.init(),
         this.ignore.init()
      ]);
   }
}

module.exports = Prettier;
