const fs = require('fs-extra');
const pMap = require('p-map');

const pathUtils = require('../Utils/path');
const logger = require('../Utils/Logger');
const Module = require("../Module/Module");
const ChildProcess = require('../Process/ChildProcess');

const EXCLUDE_DIRS = [
   'node_modules',
   '_repos',
   'application',
   'build-ui',
   'wasaby-cli_artifacts'
];

/**
 * Класс директории/папки
 */
class Directory {
   /**
    * @param [path] {String} Путь к папке.
    */
   constructor(path) {
      this.path = path;
      this.name = pathUtils.basename(this.path);
      this.dir = pathUtils.dirname(this.path);
      this.modulesDir = this.path;

      if (!fs.existsSync(this.dir)) {
         fs.ensureDirSync(this.dir);
      }
   }

   install() {
      return this;
   }

   async findModules(path, modules) {
      try {
         const dirs = await fs.readdir(path);

         await pMap(dirs, async(dirName) => {
            if (EXCLUDE_DIRS.includes(dirName) || dirName.startsWith('.')) {
               return;
            }

            const pathDir = pathUtils.join(path, dirName);

            if (this.isExcludedDir(pathDir)) {
               return;
            }

            const pathS3mod = pathUtils.join(pathDir, `${dirName}.s3mod`);

            if (fs.pathExistsSync(pathS3mod)) {
               modules.add(pathS3mod);

               return;
            }

            await this.findModules(pathDir, modules);
         }, {
            concurrency: 20
         });
      } catch (err) {
         logger.debug(`Error finding modules in directory ${path}. Error: ${err}`);
      }
   }

   async getModules() {
      if (!this.modules) {
         const modulePaths = new Set();

         this.modules = new Set();

         await this.findModules(this.modulesDir, modulePaths);

         await pMap(modulePaths, async(modulePath) => {
            const module = await Module.buildModuleFromXml(modulePath, {
               repository: this
            });

            if (module.type === 'bl') {
               return;
            }

            this.modules.add(module);
         }, {
            concurrency: 20
         });
      }

      return this.modules;
   }

   isExcludedDir(pathDir) {
      if (!fs.lstatSync(pathDir).isDirectory()) {
         return true;
      }

      return fs.pathExistsSync(pathUtils.join(pathDir, 'metaInfo.json')) ||
         fs.pathExistsSync(pathUtils.join(pathDir, 'store.json'));
   }

   async delete(platform = process.platform) {
      const childProcConfig = {
         procOptions: {
            cwd: this.dir
         },
         processName: `${this.name} delete`
      };

      try {
         if (platform === 'win32') {
            const delFile = new ChildProcess({
               commandLine: `DEL /F/Q/S ${this.name} > NUL`,
               ...childProcConfig
            });
            const delDir = new ChildProcess({
               commandLine: `RMDIR /Q/S ${this.name}`,
               ...childProcConfig
            });

            await delFile.run();
            await delDir.run();

            return;
         }

         const delSource = new ChildProcess({
            commandLine: `rm -rf ${this.name}`,
            ...childProcConfig
         });

         await delSource.run();
      } catch (err) {
         throw err;
      }
   }

   serialize() {
      return {
         path: this.path,
         dir: this.dir,
         name: this.name,
         type: 'Directory',
      }
   }
}

module.exports = Directory;
