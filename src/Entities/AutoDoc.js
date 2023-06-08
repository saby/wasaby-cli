const fs = require('fs-extra');

const pathUtils = require('../Utils/path');
const logger = require('../Utils/Logger');

class AutoDoc {
   constructor(options, subsystemController) {
      this.subsystemController = subsystemController;
      this.root = options.get('workDir');
      this.output = pathUtils.join(logger.dir, 'result');
      this.modulesListPath = pathUtils.join(logger.dir, 'modules.json');
      this.script = pathUtils.join(process.cwd(), 'node_modules', 'sbis3-auto-docs', 'steps', 'generate_js_json.py');
   }

   async build(modules) {
      const paths = [];

      for (const module of modules) {
         if (!module.forCDN) {
            paths.push(module.path);
         }
      }

      await fs.outputFile(this.modulesListPath, JSON.stringify(paths, null, 3));

      await this.subsystemController.executeScript(
         'AutoDoc',
         `--modules_list "${this.modulesListPath}" --output_folder "${this.output}"`
      );
   }
}

module.exports = AutoDoc;
