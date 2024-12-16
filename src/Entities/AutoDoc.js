const fs = require('fs-extra');

const pathUtils = require('../Utils/path');
const logger = require('../Utils/Logger');
const Npm = require('../Process/Npm');
const Python = require('../Process/Python');
const Store = require('../ModuleManager/Store');
const Builder = require('../Entities/Builder');
const TSConfig = require('../TypeSript/Config');
const Server = require('../Server/Server');

const rootRepName = 'root_sbis3-auto-docs';
const rootModules = [
   // AutodocView
   '9a059c6f-fec4-47b4-81ff-4682d88edb68',
   // Examples
   'b85b5243-610f-4c79-83bc-4a72da143c6c',
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
const generatorDocJson = new Python({
   exeFile: 'steps/generate_js_ts_route.py',
   silent: true,
   assignmentOperator: ' '
});
const installScripts = [
   new Npm({
      command: 'install',
      options: {
         production: true
      },
      silent: true
   }),
   new Npm({
      command: 'run',
      params: [
          'install_newDoc'
      ],
      silent: true
   }),
   new Npm({
      command: 'run',
      params: [
         'compile'
      ],
      silent: true,
   }),
   new Python({
      command: 'pip install',
      envArgs: {
         m: true
      },
      options: {
         'trusted-host': ['pypi.org', 'pypi.python.org', 'files.pythonhosted.org']
      },
      params: [
         'ujson',
         'requests',
         'redis',
      ],
      silent: true,
      assignmentOperator: ' '
   })
];

class AutoDoc {
   constructor(options, path) {
      this.path = path;
      this.storePath = pathUtils.join(this.path, 'store');
      this.resourcesPath = pathUtils.join(this.path, 'stand', 'resources');
      this.store = new Store(this.storePath, options.get('protocol'));
      this.revision = '';
      this.output = pathUtils.join(options.get('artifactsDir'), 'AutoDocData');
      this.workspace = pathUtils.join(options.get('artifactsDir'), 'AutoDocWorkSpace');
      this.modulesListPath = pathUtils.join(logger.dir, 'modules.json');

      if (options.get('cliVersion').endsWith('000')) {
         this.version = options.get('cliVersion').replace('000', '100');
      } else {
         this.version = options.get('cliVersion');
      }

      this.installScripts = installScripts;
      this.script = generatorDocJson;
   }

   async load() {
      await this.store.load(this.version, rootModules);

      const rootRepository = this.store.repositories.get(rootRepName);

      this.workDir = rootRepository.path;
      this.revision = rootRepository.HEAD;
   }

   async build(modules, version) {
      const paths = [];

      for (const module of modules) {
         if (!module.forCDN) {
            paths.push(module.path);
         }
      }

      await fs.outputFile(this.modulesListPath, JSON.stringify(paths, null, 3));

      this.script.procOptions = {
         ...this.script.procOptions,
         cwd: this.workDir
      };
      this.script.options = {
         ...this.script.options,
         ...{
            'modules_list': this.modulesListPath,
            'output_folder': this.output,
            'workspace': this.workspace,
            'autodoc_path': this.workDir,
            'autodoc_revision': this.revision,
         }
      };

      logger.info(`Running build data for autodoc`);

      await this.script.run();

      // Записываем файл с rc версией автодокументации.
      await fs.outputFile(
         pathUtils.join(this.output, 'ts', '1.0', 'data_version.json'),
         JSON.stringify({
            version,
            date: new Date()
         }, null, 3)
      );

      logger.info(`Build data for autodoc is finish success`);
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

      const builder = new Builder(
          this.store.modules,
          buildOptions,
          tsconfig.path
      );

      await builder.build();
      await this.copyDataInUI();
   }

   async copyDataInUI() {
      const dataPath = pathUtils.join(this.output, 'ts', '1.0');
      const buildViewPath = pathUtils.join(this.resourcesPath, 'AutodocView');

      if (fs.existsSync(dataPath) && fs.existsSync(buildViewPath)) {
         await fs.ensureSymlink(dataPath, pathUtils.join(buildViewPath, 'BLHandlers', 'Data'));
      }
   }

   async startServer() {
      const serverOptions = new Map();

      serverOptions.set('resources', this.resourcesPath);
      serverOptions.set('port', 666);
      serverOptions.set('defaultBLRoot', 'AutodocView');
      serverOptions.set('release', true);

      this.stand = new Server(serverOptions, '/page/autodoc-ts/');

      await this.stand.start();
   }

   serialize() {
      return {
         revision: this.revision,
         path: this.path,
         workDir: this.workDir
      }
   }
}

module.exports = AutoDoc;
