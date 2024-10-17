const fs = require('fs-extra');
const pMap = require('p-map');

const pathUtils = require('./Utils/path');
const ModulesMap = require('./Map/Modules');
const RepositoriesMap = require('./Map/Repositories');
const logger = require('./Utils/Logger');

const DEFAULT_MODULES_MAP = fs.readJsonSync(pathUtils.join(__dirname, '../resources/modulesMap.json'));
//TODO КОСТЫЛЬ. Временное решения для тестов по веткам прикладников, сейчас мы походу убивает git количеством git clone
//  Убираем паралельную обработку если стоит WASABY_CLI_ENABLE_LABELS.
const PARALLEL_INIT_REPOS = !!process.env.WASABY_CLI_ENABLE_LABELS ? 1 : 3;

class Store {
   constructor(cfg = {}) {
      this.repositories = new RepositoriesMap(cfg.repositories);
      this.modules = new ModulesMap();
      this.newModules = new ModulesMap();

      if (cfg.modules) {
         for (const module of Object.values(cfg.modules)) {
            module.repository = this.repositories.get(module.repository);
         }

         this.modules = new ModulesMap(cfg.modules);
      } else {
         this.modules = new ModulesMap(DEFAULT_MODULES_MAP);
      }
   }

   async save(path) {
      this.modules = this.newModules;
      this.newModules = new ModulesMap();

      const serializeCache = JSON.stringify(this.serialize(), null, 3);

      await Promise.all([
         fs.outputFile(path, serializeCache),
         logger.writeFile('store.json', serializeCache)
      ]);
   }

   async addRepos(repositories) {
      const addedRepositories = new Set();
      const strategiesCheckout = new Map();

      await pMap(repositories, async(repository) => {
         if (this.repositories.has(repository.name)) {
            return;
         }

         addedRepositories.add(repository);
         this.repositories.add(repository);

         await repository.init();
      }, {
         concurrency: PARALLEL_INIT_REPOS
      });

      for (const repository of addedRepositories) {
         strategiesCheckout.set(repository.name, await repository.detectCheckoutStrategy());
      }

      await pMap(addedRepositories, async(repository) => {
         await repository.checkoutByStrategy(strategiesCheckout.get(repository.name));

         const modules = await repository.getModules();

         this.modules.merge(modules);
         this.newModules.merge(modules);
      }, {
         concurrency: PARALLEL_INIT_REPOS
      });

      for (const repository of addedRepositories) {
         repository.HEAD = await repository.revParse('HEAD');
      }
   }

   hasModule(name) {
      return this.newModules.has(name) || this.modules.has(name);
   }

   getModules(modulesNames) {
      const result = new Set();

      for (const moduleName of modulesNames) {
         const module = this.getModule(moduleName);

         if (module) {
            result.add(module);
         }
      }

      return result;
   }

   getModule(name) {
      return this.newModules.get(name) || this.modules.get(name);
   }

   getCDNModules() {
      const modules = new Set();

      for (const module of this.modules.all.values()) {
         if (module.forCDN) {
            modules.add(module);
         }
      }

      return modules;
   }

   getDependentModules(depends, type = 'all', checkRepository) {
      const result = new Set();

      for (const module of this.modules[type].values()) {
         for (const depend of depends) {
            const isDepend = module.depends.includes(depend.name);
            const isOneRepository = module.repository === depend.repository || !checkRepository;

            if (isDepend && isOneRepository) {
               result.add(module);
            }
         }
      }

      return result;
   }

   getDependenciesModules(modules) {
      for (const module of modules) {
         for (const depend of this.getModules(module.depends)) {
            if (!modules.has(depend)) {
               modules.add(depend);

               this.getDependenciesModules(modules);
            }
         }
      }
   }

   getModulesByRepos(repName, type = 'all') {
      const result = new Set();

      if (!this.repositories.has(repName)) {
         return result;
      }

      for (const module of this.modules[type].values()) {
         if (module.repository.name === repName) {
            result.add(module);
         }
      }

      return result;
   }

   serialize() {
      return {
         repositories: this.repositories.serialize(),
         modules: this.modules.serialize()
      };
   }
}

module.exports = Store;
