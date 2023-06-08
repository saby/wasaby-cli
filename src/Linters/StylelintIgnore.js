const pathUtils = require('../Utils/path');
const Base = require('./Base');

class StylelintIgnore extends Base {
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
