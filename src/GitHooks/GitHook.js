const fs = require('fs-extra');
const pathUtils = require('../Utils/path');
const logger = require('../Utils/Logger');

class GitHook {
   constructor(name, repository) {
      this.name = name;
      this.path = pathUtils.join(logger.dir, name);
      this.repository = repository;
   }

   async init() {
      const template = await fs.readFile(pathUtils.join(__dirname, `templates/${this.name}.js`), 'utf-8');

      const hook = template.replace('#ROOT_PROJECT#', pathUtils.normalize(process.cwd()));

      await fs.outputFile(this.path, hook);

      await this.repository.setHookPath(pathUtils.dirname(this.path));
   }
}

module.exports = GitHook;
