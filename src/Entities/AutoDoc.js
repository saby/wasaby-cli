const fs = require('fs-extra');
const pathUtils = require('../Utils/path');
const Store = require('../ModuleManager/Store');
const logger = require('../Utils/Logger');
const Npm = require('../Process/Npm');
const NodeJS = require('../Process/NodeJS');
const Repository = require('./Repository');
const TSConfig = require("../TypeSript/Config");
const Builder = require("./Builder");
const Server = require("../Server/Server");

const LOCAL_STAND_MODULES = [
   // AutodocView
   '9a059c6f-fec4-47b4-81ff-4682d88edb68',
   // FeatureLocale
   '09f73929-c09d-47c2-801f-2dc0cd428ef6',
   // FeatureSubscriptionLocal
   '1b8c399e-1f6e-4d28-aa5f-397980c0d02c',
   // BasicAccessDenied
   '275bcd6b-36d0-4b00-a438-65a3c180ddae',
   // SbisUI
   '658445b8-42ed-4c6a-b649-c6ee7634ed66',
   // WorkTimeManagementBase
   '2416fc7c-6888-4926-9b1b-1a593fd7b7cd',
];

const DEFAULT_MODULES = [
   // Typescript
   '0e6a9dbb-14e5-4382-9430-b6e73a53dc79',
   // ThemeModules
   'f515eba2-dad5-4cc3-bef8-2ff45bd2a880',
];

const installScripts = [
   new Npm({
      command: 'install',
      options: {
         production: true
      },
      silent: true
   }),
];

class AutoDoc {
   constructor(options, path) {
      this.path = path;
      this.options = options;
      this.storePath = pathUtils.join(this.path, 'store');
      this.resourcesPath = pathUtils.join(this.path, 'stand', 'resources');
      this.store = new Store(this.storePath, options, true);
      this.revision = '';
      this.output = pathUtils.join(options.get('artifactsDir'), 'AutoDocWorkSpace', 'output');
      this.workspace = pathUtils.join(options.get('artifactsDir'), 'AutoDocWorkSpace');
      this.configPath = pathUtils.join(this.workspace, 'modules.json');

      if (options.get('cliVersion').endsWith('000')) {
         this.version = options.get('cliVersion').replace('000', '100');
      } else {
         this.version = options.get('cliVersion');
      }

      const rootRep = new Repository({
         url: 'git@git.sbis.ru:saby/auto-docs-ts.git',
         protocol: this.options.get('protocol'),
         requiredBranch: `rc-${this.options.get('cliVersion')}`,
         dir: this.storePath
      });
      this.rootRepName = rootRep.name;
      this.repositories = new Map([[
         this.rootRepName,
         rootRep
      ]]);

      this.installScripts = installScripts;
   }

   async load() {
      this.store.clear();

      await this.store.loadRepositories(this.repositories);

      const rootRepository = this.store.repositories.get(this.rootRepName);

      this.workDir = rootRepository.path;
      this.revision = rootRepository.HEAD;
   }

   async tryLoadKaizen() {
      const options = {
         root: this.workspace,
         'cloud': 'cloud.sbis.ru',
         'app-version': this.version,
         'kaizen-only': true
      };

      if (this.options.has('cpuLimit')) {
         const cpuLimit = Number(this.options.get('cpuLimit'));

         if (Number.isFinite(cpuLimit)) {
            options['cpu-limit'] = cpuLimit;
         }
      }

      if (this.options.has('logLevel')) {
         options['log-level'] = this.options.get('logLevel');
      }

      if (this.options.has('colors')) {
         options['colors'] = this.options.get('colors');
      }

      const script = new NodeJS({
         type: 'spawn',
         exeFile: 'cli.js',
         force: this.options.get('force'),
         command: 'load',
         procOptions: {
            cwd: this.workDir
         },
         options
      });

      return script.run();
   }

   async build(modules) {
      await fs.mkdir(this.workspace, {
         recursive: true,
         force: true
      });

      await this.writeConfig(modules);

      const options = {
         root: this.workspace,
         output: this.output,
         modules: this.configPath,
         'disable-git-revisions-check': true,
         'allow-no-modules': true
      };

      if (this.options.has('cpuLimit')) {
         const cpuLimit = Number(this.options.get('cpuLimit'));

         if (Number.isFinite(cpuLimit)) {
            options['cpu-limit'] = cpuLimit;
         }
      }

      if (this.options.has('logLevel')) {
         options['log-level'] = this.options.get('logLevel');
      }

      if (this.options.get('dry')) {
         options['dry'] = true;
      }

      if (this.options.has('reporter')) {
         options['reporter'] = this.options.get('reporter');
      }

      const script = new NodeJS({
         type: 'spawn',
         exeFile: 'cli.js',
         force: this.options.get('force'),
         command: 'build',
         procOptions: {
            cwd: this.workDir
         },
         options
      });

      logger.info(`Running build data pack for autodoc`);

      return script.run();
   }

   async writeConfig(targetModules) {
      const modules = [];
      const revisions = new Map();

      for await (const moduleInfo of targetModules.values()) {
         if (!revisions.has(moduleInfo.repository.ssh)) {
            revisions.set(
               moduleInfo.repository.ssh,
               await moduleInfo.repository.revParse()
            );
         }

         modules.push({
            filePath: moduleInfo.s3mod,
            git: {
               url: moduleInfo.repository.ssh,
               revision: revisions.get(moduleInfo.repository.ssh),
               path: pathUtils.relative(
                  moduleInfo.repository.path,
                  moduleInfo.dir
               )
            }
         });
      }

      await fs.writeJSON(this.configPath, modules, { encoding: 'utf-8', spaces: 3 });
   }

   async loadStandSources() {
      await this.store.loadModules(this.version, LOCAL_STAND_MODULES);

      await this.store.save();
   }

   async buildStand() {
      const buildOptions = new Map();
      const tsconfig = new TSConfig({
         root: logger.dir,
         type: 'build'
      });

      await tsconfig.save();

      buildOptions.set('resources', this.resourcesPath);
      buildOptions.set(
         'builderCache',
         pathUtils.join(pathUtils.dirname(this.resourcesPath), 'builderCache')
      );
      buildOptions.set('rc', this.version);
      buildOptions.set('isLocaleProject', true);
      buildOptions.set('copy', true);
      buildOptions.set('release', true);
      buildOptions.set('force', true);
      buildOptions.set('logLevel', 'error');

      const roots = this.store.getModules({
         id: [...DEFAULT_MODULES, ...LOCAL_STAND_MODULES]
      });

      const { modules } = this.store.getDependencies(new Map([
         ...roots,
         ...this.getCDNModules()
      ]));

      const builder = new Builder(
         modules,
         buildOptions,
         tsconfig.path,
         [],
         {
            '/page': 'WiPageConfig/page'
         }
      );

      logger.info(`Running build stand for autodoc`);

      return builder.build();
   }

   async copyDataInUI() {
      const buildViewPath = pathUtils.join(this.resourcesPath, 'AutodocView');

      if (fs.existsSync(this.output) && fs.existsSync(buildViewPath)) {
         const targetPath = pathUtils.join(buildViewPath, 'BLHandlers', 'Data');

         if (fs.existsSync(targetPath)) {
            await fs.promises.unlink(targetPath);
         }

         await fs.createSymlink(this.output, targetPath, 'dir');
      }
   }

   async startServer() {
      const serverOptions = new Map();

      serverOptions.set('resources', this.resourcesPath);
      serverOptions.set('port', 666);
      serverOptions.set('defaultBLRoot', 'AutodocView');
      serverOptions.set('release', true);

      this.stand = new Server(serverOptions, {
         rootUrl: '/page/autodoc-ts/'
      });

      await this.stand.start();
   }

   getCDNModules() {
      return this.store.getModules({
         forCDN: [true]
      });
   }

   serialize() {
      return {
         revision: this.revision,
         path: this.path,
         workDir: this.workDir
      };
   }
}

module.exports = AutoDoc;
