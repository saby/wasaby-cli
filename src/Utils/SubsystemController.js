const fs = require('fs-extra');

const logger = require('./Logger');
const pathUtils = require('./path');
const ChildProcess = require('../Utils/ChildProcess');
const Repository = require('../Entities/Repository');

const availableSubsystem = {
   AutoDoc: {
      source: 'https://git.sbis.ru/root/sbis3-auto-docs.git',
      script: `${process.platform === 'win32' ? 'python' : 'python3'} "steps/generate_js_json.py"`,
      installScript: 'npm install --production'
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

      this.installed.set(name, subsystem);

      await this.saveMeta();
   }

   async update(name) {
      const subsystem = this.installed.get(name);

      await fs.remove(subsystem.path);

      await this.load(name);
   }

   async needUpdate(name) {
      const subsystem = this.installed.get(name);

      return subsystem.HEAD !== await subsystem.getRemoteRevision(`rc-${this.version}`);
   }

   static async runInstallScript(subsystem) {
      const installScript = new ChildProcess({
         commandLine: availableSubsystem[subsystem.name].installScript,
         procOptions: {
            cwd: subsystem.path
         },
         silent: true
      });

      await installScript.run();
   }

   async saveMeta() {
      const result = {};

      for (const [name, subsystem] of this.installed) {
         result[name] = subsystem.serialize();
      }

      await fs.writeJson(this.metaFile, result);
   }

   async executeScript(name, args) {
      const subsystem = this.installed.get(name);
      const infoSubsystem = availableSubsystem[name];
      const userScript = new ChildProcess({
         commandLine: `${infoSubsystem.script} ${args}`,
         procOptions: {
            cwd: subsystem.path
         },
         silent: true
      });

      logger.info(`Running script of ${name} subsystem`);

      await userScript.run();

      logger.info(`Script of ${name} subsystem is done`);
   }
}

module.exports = SubsystemController;
