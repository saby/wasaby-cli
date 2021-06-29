const fs = require('fs-extra');
const path = require('path');
const isUrl = /(git|ssh|https?|git@[-\w.]+):/;

const arrayParamsList = [
   'rep',
   'modules',
   'entry',
   'tasks',
   'moduleName'
];


class Config {
   constructor() {
      this.consoleParams = new Map();
      this.packageParams = new Map();
      this.command = '';

      this.readConsole();
      this.readPackageJson();

      this.params = new Map([...this.packageParams, ...this.consoleParams]);
   }

   readConsole() {
      const argv = process.argv.slice(2);

      if (!argv[0].startsWith('--')) {
         this.command = argv[0];
      }

      for (const arg of argv) {
         if (arg.startsWith('--')) {

            const argName = arg.substr(2);
            const [name, value] = argName.split('=', 2);

            this.consoleParams.set(name, Config.prepareConsoleParam(name, value));
         }
      }
   }

   readPackageJson() {
      const packageJson = this.getPackageJson(process.cwd()) || require('./../../package.json');
      const baseConfig = require('./../../config.json');
      const wcSection = packageJson['wasaby-cli'] || {};

      this.packageParams.set('rc', `rc-${packageJson.version.split('.').splice(0, 2).join('.')}`);
      this.packageParams.set('workDir', baseConfig.workDir);

      this.prepareRepositories(baseConfig);

      if (packageJson.name !== 'wasaby-cli') {
         this.packageParams.set('rep', [packageJson.name]);

         if (!baseConfig.repositories.hasOwnProperty(packageJson.name)) {
            baseConfig.repositories[packageJson.name] = {};
         }

         baseConfig.repositories[packageJson.name].skipStore = true;
         baseConfig.repositories[packageJson.name].localeRep = true;
         baseConfig.repositories[packageJson.name].path = process.cwd();

         wcSection.repositories = {...baseConfig.repositories, ...this.extractRepsFromPackageJson(wcSection)};
      }

      for (const [paramName, value] of Object.entries({...baseConfig, ...wcSection})) {
         this.packageParams.set(paramName, value);
      }
   }

   extractRepsFromPackageJson(section) {
      const result = {};

      if (!section.repositories) {
         return result;
      }

      for (const repName of section.repositories) {
         const link = section.repositories[repName];

         if (isUrl.test(link)) {
            const [url, version] = link.split('#');

            result[repName] = {
               url,
               version,
               load: true
            };

            continue;
         }

         result[repName] = {
            path: path.isAbsolute(link) ? link : path.normalize(path.join(process.cwd(), link)),
            skipStore: true
         };
      }

      return result;
   }

   getPackageJson(pathToRep) {
      const configPath = path.join(pathToRep, 'package.json');

      if (fs.existsSync(configPath)) {
         return fs.readJSONSync(configPath);
      }

      return undefined;
   }

   prepareRepositories(config) {
      const gitMirror = this.consoleParams.gitMirror || config.gitMirror;
      let prefix = 'https://';
      let suffix = '/';

      if (this.consoleParams.get('protocol') === 'ssh') {
         prefix = 'git@';
         suffix = ':';
      }

      for (const [repName, rep] of Object.entries(config.repositories)) {
         let repPath = this.consoleParams.get(repName);

         rep.url = `${prefix}${rep.mirror || gitMirror}${suffix}${rep.url}.git`;

         if (repPath) {
            if (!path.isAbsolute(repPath)) {
               repPath = path.normalize(path.join(process.cwd(), repPath));
            }

            if (fs.existsSync(repPath)) {
               config.repositories[repName].path = repPath;
            }
         }
      }
   }

   static prepareConsoleParam(key, value) {
      if (value === undefined) {
         return true;
      }

      if (arrayParamsList.includes(key)) {
         return value.split(',').map((value) => value.trim());
      }

      return value
   }
}

module.exports = Config;
