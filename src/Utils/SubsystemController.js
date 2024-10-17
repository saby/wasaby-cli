const fs = require('fs-extra');
const pMap = require('p-map');

const logger = require('./Logger');
const pathUtils = require('./path');

const availableSubsystem = {
   AutoDoc: require('../Entities/AutoDoc')
};

class SubsystemController {
   constructor(options) {
      this.installed = new Map();
      this.options = options;
      this.version = options.get('cliVersion');
      this.storePath = pathUtils.join(options.get('artifactsDir'), 'subsystems');
      this.metaFile = pathUtils.join(options.get('artifactsDir'), 'subsystems/installedSubsystems.json');

      if (fs.pathExistsSync(this.metaFile)) {
         for (const [name, subsystem] of Object.entries(fs.readJsonSync(this.metaFile))) {
            if (availableSubsystem.hasOwnProperty(name)) {
               this.installed.set(name, subsystem);
            }
         }
      }
   }

   async init(name) {
      if (!availableSubsystem.hasOwnProperty(name)) {
         throw new Error(`Subsystem "${name}" is not supported.`);
      }

      const subsystemPath = pathUtils.join(this.storePath, name);
      const subsystem = new availableSubsystem[name](this.options, subsystemPath);
      subsystem.name = name;

      logger.info(`Load "${name}" subsystem.`);

      await subsystem.load();

      if (this.installed.has(name)) {
         const currentRevision = subsystem.revision;
         const previsionRevision = this.installed.get(name).revision;

         if (previsionRevision !== currentRevision) {
            await SubsystemController.runInstallScript(subsystem);
         }
      } else {
         await SubsystemController.runInstallScript(subsystem);
      }

      this.installed.set(name, subsystem);

      await this.saveMeta();

      logger.info(`"${name}" subsystem is ready.`);
   }

   get(name) {
      if (!this.installed.has(name)) {
         throw new Error(`Subsystem "${name}" is not install.`);
      }

      return this.installed.get(name);
   }

   async getModules(store) {
      return await this.getDepsModules(store, await this.getRootModules());
   }

   async getRootModules() {
      let result = new Set();

      await pMap(this.installed.values(), async (repository) => {
         const modules = await repository.getModules();

         for (const module of modules.ui.values()) {
            result.add(module);
         }
      });

      return result;
   }

   async getDepsModules(store, root) {
      const rootModules = root || await this.getRootModules();
      store.getDependenciesModules()
   }

   static async runInstallScript(subsystem) {
      logger.info(`Install "${subsystem.name}" subsystem.`);

      const installScripts = subsystem.installScripts;

      await pMap(installScripts, async (installScript) => {
         installScript.procOptions = {
            ...installScript.procOptions,
            cwd: subsystem.workDir
         };

         await installScript.run();
      }, {
         concurrency: 1
      });
   }

   async saveMeta() {
      const result = {};

      for (const [name, subsystem] of this.installed) {
         result[name] = subsystem.serialize();
      }

      await fs.writeJson(this.metaFile, result);
   }
}

module.exports = SubsystemController;
