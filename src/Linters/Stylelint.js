const pathUtils = require('../Utils/path');
const Base = require('./Base');
const StylelintIgnore = require('./StylelintIgnore');

class Stylelint extends Base {
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

   async init() {
      await Promise.all([
         super.init(),
         this.ignore.init()
      ]);
   }
}

module.exports = Stylelint;
