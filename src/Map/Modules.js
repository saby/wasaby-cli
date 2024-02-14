const Module = require('../Module/Module');

const IGNORE_MODULES = ['NoticeCenterPluginUnit', 'NoticeSettingsUnit'];

class Modules {
   constructor(modules) {
      this.ui = new Map();
      this.test = new Map();
      this.demo = new Map();
      this.all = new Map();

      if (modules) {
         for (const module of Object.values(modules)) {
            this.add(Module.buildModuleFromObject(module));
         }
      }
   }

   get(name, type = 'all') {
      return this[type].get(name);
   }

   getModules(modulesNames, type = 'all') {
      if (!modulesNames) {
         return new Set([...this[type].values()]);
      }

      const result = new Set();

      for (const name of modulesNames) {
         const module = this.get(name, type);

         if (!module) {
            continue;
         }

         result.add(module);
      }

      return result;
   }

   delete(moduleName) {
      this.all.delete(moduleName);
      this.ui.delete(moduleName);
      this.demo.delete(moduleName);
      this.test.delete(moduleName);
   }

   add(module) {
      if (module.type === 'bl' || IGNORE_MODULES.includes(module.name)) {
         return;
      }

      if (this.all.has(module.name)) {
         this.all.get(module.name).merge(module);
         this[module.type].get(module.name).merge(module);
      } else {
         this.all.set(module.name, module);
         this[module.type].set(module.name, module);
      }
   }

   addModules(modules) {
      for (const module of modules) {
         this.add(module);
      }
   }

   has(name, type = 'all') {
      return this[type].has(name);
   }

   merge(modules) {
      for (const module of modules.all.values()) {
         this.add(module);
      }
   }

   serialize() {
      const modules = {};

      for (const module of this.getModules()) {
         modules[module.name] = module.serialize();
      }

      return modules;
   }
}

module.exports = Modules;
