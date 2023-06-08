const pathUtils = require('../Utils/path');
const fs = require('fs-extra');
const Base = require('./Base');

const NAME_CONFIG = 'tailwind.config.js';

class Tailwind extends Base {
   constructor(TailwindModule) {
      super();

      this.name = 'Tailwind';
      this.source = pathUtils.join(TailwindModule.path, NAME_CONFIG);
      this.path = pathUtils.join(process.cwd(), NAME_CONFIG);
      this.file = fs.readFileSync(this.source);
   }
}

module.exports = Tailwind;
