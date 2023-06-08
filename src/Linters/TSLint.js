const pathUtils = require('../Utils/path');
const Base = require('./Base');

class TSLint extends Base {
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
