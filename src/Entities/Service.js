const xml = require('../Utils/xml');
const fs = require('fs-extra');

const pathUtils = require('../Utils/path');

const services = new Map();

class Service {
   constructor(path, sdkPath) {
      this.path = path;
      this.name = pathUtils.basename(this.path, '.s3srv');
      this.sdkPath = sdkPath;
      this.ready = this.buildAst();
   }

   // Только для юнитов
   static clearCache() {
      services.clear();
   }

   async buildAst() {
      this.ast = await xml.readXmlFile(this.path);
      this.modules = new Map();
      this.parents = new Set();

      this.id = this.ast.service.$.id;

      if (typeof this.ast.service.items[0] === 'object') {
         this.ast.service.items[0].ui_module = this.ast.service.items[0].ui_module || [];
      } else {
         this.ast.service.items[0] = { ui_module: [] };
      }

      for (const module of this.ast.service.items[0].ui_module) {
         this.modules.set(module.$.name, module.$);
      }

      if (this.ast.service.items[0]?.bl_module) {
         for (const module of this.ast.service.items[0].bl_module) {
            if (module.$.url) {
               module.$.url = this.getPath(module.$.url);
            } else {
               module.$.url = pathUtils.join(this.sdkPath, `bl-modules/${module.$.name}/${module.$.name}.s3mod`);
            }
         }
      }

      if (this.ast.service.parent) {
         for (const parent of this.ast.service.parent) {
            const parentPath = this.getPath(parent.$.path);

            if (fs.pathExistsSync(parentPath)) {
               if (!services.has(parentPath)) {
                  services.set(parentPath, new Service(parentPath, this.sdkPath));
               }

               this.parents.add(services.get(parentPath));
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
      const items = {
         ui_module: [],
      };

      if (this.ast.service.items[0]?.bl_module) {
         items.bl_module = this.ast.service.items[0].bl_module;
      }

      this.ast.service.items[0] = items;
   }

   async getAllService() {
      await this.ready;

      let parents = new Set([this]);

      for (const parent of this.parents) {
         parents = parents.union(await parent.getAllService());
      }

      return parents;
   }

   async addModules(modules) {
      await this.ready;

      for (const module of modules) {
         if (module.environment === 'Python') {
            continue;
         }

         const xmlObj = {
            id: module.id,
            name: module.name,
            url: module.s3mod
         };

         this.modules.set(module.name, xmlObj);
         this.ast.service.items[0].ui_module.push({
            $: xmlObj
         });
      }
   }

   async save() {
      await this.ready;

      if (this.parents.size !== 0) {
         this.ast.service.parent = [];

         for (const parent of this.parents) {
            this.ast.service.parent.push({
               $: {
                  id: parent.id,
                  path: pathUtils.relative(pathUtils.dirname(this.path), parent.path)
               }
            });
         }
      }

      await xml.writeXmlFile(this.path, this.ast);
   }

   getPath(path) {
      if (path.startsWith('$(SBISPlatformSDK)')) {
         const relSdkPath = path.replace('$(SBISPlatformSDK)', '');

         return pathUtils.join(this.sdkPath, relSdkPath);
      }

      if (fs.pathExistsSync(path)) {
         return path;
      }

      const dirPath = pathUtils.dirname(this.path);

      return pathUtils.join(dirPath, path);
   }
}

module.exports = Service;
