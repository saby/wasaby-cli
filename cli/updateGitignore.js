const fs = require('fs-extra');

const pathUtils = require('../src/Utils/path');

const ignorePaths = [
   '/wasaby-cli_artifacts',
   '/application',
   '/build-ui',
   '/tslint.json',
   '/tslib.js',
   '/wasaby-cli_artifacts',
   '/**/tsconfig.json',
   '/wasabyGlobalTypings.d.ts',
   '/tailwind.config.js',
   '/.eslintrc.js',
   '/.stylelintrc.js',
   '.stylelintignore',
   '/.prettierrc.js',
   '.prettierignore'
];

module.exports = async(options) => {
   const path = pathUtils.join(options.params.get('gitignorePath') || process.cwd(), '.gitignore');

   if (fs.pathExistsSync(path)) {
      const gitignore = fs.readFileSync(path, 'utf8').trim().split('\n').map(ignorePath => ignorePath.trim());
      let needWrite = false;

      for (const ignorePath of ignorePaths) {
         if (!gitignore.includes(ignorePath)) {
            gitignore.push(ignorePath);
            needWrite = true;
         }
      }

      if (needWrite) {
         await fs.outputFile(path, gitignore.join('\n'));
      }
   } else {
      await fs.outputFile(path, ignorePaths.join('\n'));
   }
};
