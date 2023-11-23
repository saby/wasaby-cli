const fs = require('fs-extra');
const pMap = require('p-map');

const logger = require('./Logger');
const pathUtils = require('./path');
const Npm = require('../Process/Npm');
const Python = require('../Process/Python');
const Repository = require('../Entities/Repository');

const availableSubsystem = {
   AutoDoc: {
      source: 'https://git.sbis.ru/root/sbis3-auto-docs.git',
      script: new Python({
         exeFile: 'steps/generate_js_json.py',
         silent: true,
         assignmentOperator: ' '
      }),
      installScript: new Npm({
         command: 'install',
         options: {
            production: true
         },
         silent: true
      }),
      postInstallScript: new Npm({
         command: 'run',
         params: [
            'compile'
         ],
         silent: true,
      })
   }
};

class SubsystemController {
   constructor(options) {
      this.installed = new Map();
      this.version = options.get('cliVersion');
      this.storePath = pathUtils.join(options.get('store'), '../subsystems');
      this.metaFile = pathUtils.join(options.get('store'), '../subsystems/installedSubsystems.json');

      if (fs.pathExistsSync(this.metaFile)) {
         for (const [name, subsystem] of Object.entries(fs.readJsonSync(this.metaFile))) {
            if (availableSubsystem.hasOwnProperty(name)) {
               this.installed.set(name, new Repository(subsystem));
            }
         }
      } else {
         fs.removeSync(this.storePath);
      }
   }

   async init(name) {
      if (!availableSubsystem.hasOwnProperty(name)) {
         throw new Error(`Subsystem "${name}" is not supported.`);
      }

      if (this.installed.has(name)) {
         if (await this.needUpdate(name)) {
            logger.info(`Update "${name}" subsystem.`);

            await this.update(name);
         }
      } else {
         logger.info(`Install "${name}" subsystem.`);

         await this.load(name);
      }

      logger.info(`"${name}" subsystem is ready.`);
   }

   async load(name) {
      const subsystem = new Repository({
         name,
         dir: this.storePath,
         url: availableSubsystem[name].source
      });

      await fs.ensureDir(this.storePath);

      await subsystem.shadowClone(`rc-${this.version}`);

      subsystem.HEAD = await subsystem.revParse('HEAD');

      await SubsystemController.runInstallScript(subsystem);

      await SubsystemController.runPostInstallScript(subsystem);

      this.installed.set(name, subsystem);

      await this.saveMeta();
   }

   async update(name) {
      const subsystem = this.installed.get(name);

      if (typeof subsystem.delete === 'function') {
         await subsystem.delete(process.platform);
      } else {
         await fs.remove(subsystem.path);
      }

      await this.load(name);
   }

   async needUpdate(name) {
      const subsystem = this.installed.get(name);

      return subsystem.HEAD !== await subsystem.getRemoteRevision(`rc-${this.version}`);
   }

   async getModules() {
      let result = new Set();

      await pMap(this.installed.values(), async (repository) => {
         const modules = await repository.getModules();

         for (const module of modules.ui.values()) {
            result.add(module);
         }
      });

      return result;
   }

   static async runInstallScript(subsystem) {
      const installScript = availableSubsystem[subsystem.name].installScript;

      installScript.procOptions = {
         ...installScript.procOptions,
         cwd: subsystem.path
      };

      await installScript.run();
   }

   static async runPostInstallScript(subsystem) {
      const postInstallScript = availableSubsystem[subsystem.name].postInstallScript;

      if (postInstallScript) {
         postInstallScript.procOptions = {
            ...postInstallScript.procOptions,
            cwd: subsystem.path
         };

         await postInstallScript.run();
      }
   }

   async saveMeta() {
      const result = {};

      for (const [name, subsystem] of this.installed) {
         result[name] = subsystem.serialize();
      }

      await fs.writeJson(this.metaFile, result);
   }

   async executeScript(name, options) {
      const subsystem = this.installed.get(name);
      const userScript = availableSubsystem[name].script;

      userScript.procOptions = {
         ...userScript.procOptions,
         cwd: subsystem.path
      };
      userScript.options = {
         ...userScript.options,
         ...options
      };

      logger.info(`Running script of ${name} subsystem`);

      await userScript.run();

      logger.info(`Script of ${name} subsystem is done`);
   }
}

module.exports = SubsystemController;
