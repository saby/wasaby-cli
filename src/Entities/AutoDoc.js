const fs = require('fs-extra');

const pathUtils = require('../Utils/path');
const logger = require('../Utils/Logger');

class AutoDoc {
   constructor(options, subsystemController) {
      this.subsystemController = subsystemController;
      this.root = options.get('workDir');
      this.output = pathUtils.join(options.get('artifactsDir'), 'AutoDocData');
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

      const autoDoc = this.subsystemController.installed.get('AutoDoc');

      await this.subsystemController.executeScript('AutoDoc', {
         'modules_list': this.modulesListPath,
         'output_folder': this.output,
         'autodoc_path': autoDoc.path,
         'autodoc_revision': autoDoc.HEAD
      });
   }

   async postBuild(buildAppPath) {
      const dataPath = pathUtils.join(this.output, 'js', '1.0');
      const buildViewPath = pathUtils.join(buildAppPath, 'AutodocView');

      if (fs.existsSync(dataPath) && fs.existsSync(buildViewPath)) {
         await fs.ensureSymlink(dataPath, pathUtils.join(buildViewPath, 'BLHandlers', 'Data'));
      }
   }
}

module.exports = AutoDoc;
