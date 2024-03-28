const xml = require('../Utils/xml');
const fs = require('fs-extra');

const pathUtils = require('../Utils/path');

class Service {
   constructor(path) {
      this.path = path;
      this.ready = this.buildAst();
   }

   async buildAst() {
      this.ast = await xml.readXmlFile(this.path);
      this.modules = new Map();
      this.parents = new Set();

      if (typeof this.ast.service.items[0] === 'object') {
         this.ast.service.items[0].ui_module = this.ast.service.items[0].ui_module || [];
      } else {
         this.ast.service.items[0] = { ui_module: [] };
      }

      for (const module of this.ast.service.items[0].ui_module) {
         this.modules.set(module.$.name, module.$);
      }

      if (this.ast.service.parent) {
         const dirPath = pathUtils.dirname(this.path);

         for (const parent of this.ast.service.parent) {
            const parentPath = pathUtils.join(dirPath, parent.$.path);

            if (fs.pathExistsSync(parentPath)) {
               this.parents.add(new Service(parentPath));
            }
         }
      }
   }

   async getModules() {
      await this.ready;

      return this.modules;
   }

   deleteModules() {
      this.modules = new Map();
      this.ast.service.items[0] = {
         ui_module: []
      };
   }

   async getAllService() {
      await this.ready;

      let parents = [this];

      for (const parent of this.parents) {
         parents = [...parents, ...await parent.getAllService()];
      }

      return new Set(parents);
   }

   async addModules(modules) {
      await this.ready;

      for (const module of modules) {
         this.modules.set(module.name, module);
         this.ast.service.items[0].ui_module.push({
            $: module
         });
      }
   }

   async save() {
      await this.ready;

      await xml.writeXmlFile(this.path, this.ast);
   }
}

module.exports = Service;
