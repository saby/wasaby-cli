const pathUtils = require('../Utils/path');
const Base = require('./Base');

class PrettierIgnore extends Base {
   constructor(ignorePaths) {
      super();

      this.path = pathUtils.join(process.cwd(), '.prettierignore');
      this.name = 'PrettierIgnore';

      const dir = pathUtils.dirname(this.path);
      const ignoreFiles = [
         '/node_modules/',
         '*.json',
         '*.md',
         '*.html',
         '*.min.js',
         '.clang-format'
      ];

      for (const path of ignorePaths) {
         ignoreFiles.push(`${path.replace(dir, '')}/`);
      }

      this.file = ignoreFiles.join('\n');
   }
}

module.exports = PrettierIgnore;
