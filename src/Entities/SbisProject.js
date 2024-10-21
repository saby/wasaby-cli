const pathUtils = require('../Utils/path');
const xml = require('../Utils/xml');
const Service = require('../Entities/Service');
const pMap = require('p-map');

class SbisProject {
   constructor(path, sdkPath) {
      this.path = path;
      this.dir = pathUtils.dirname(this.path);
      this.name = pathUtils.basename(this.path, '.s3cld');
      this.sdkPath = sdkPath;
      this.ready = this.buildAst();
   }

   async buildAst() {
      this.ast = await xml.readXmlFile(this.path);
      this.services = new Map();

      for (const {$: info} of this.ast.cloud.items[0].service) {
         if (info.url.endsWith('UI.s3srv')) {
            this.uiService = new Service(pathUtils.join(this.dir, info.url), this.sdkPath);
         } else {
            this.blService = new Service(pathUtils.join(this.dir, info.url), this.sdkPath);
         }
      }
   }

   async getUIModules() {
      await this.ready;

      const result = new Map();

      await pMap(await this.uiService.getAllService(), async(service) => {
         for (const [name, module] of await service.getModules()) {
            result.set(name, module);
         }
      }, {
         concurrency: 10
      });

      return result;
   }

   async deleteUIModules() {
      await this.ready;

      const services = await this.uiService.getAllService();

      await pMap(services, async(service) => {
         service.deleteModules();
      }, {
         concurrency: 10
      });
   }

   async addUIModules(modules) {
      await this.ready;

      await this.uiService.addModules(modules);
   }

   async copy(target) {
      await this.ready;

      const services = [ ...await this.uiService.getAllService(), ...await this.blService.getAllService()];

      await pMap(services, async(service) => {
         service.path = pathUtils.join(target, `${service.name}.s3srv`);
      }, {
         concurrency: 10
      });

      await pMap(services, async(service) => {
         await service.save();
      }, {
         concurrency: 10
      });

      // this.path = pathUtils.join(target, `${this.name}.s3cld`);
      // this.dir = target;

      await this.save(this.path, this.ast);
   }

   async save() {
      this.ast.cloud.items[0].service = [
         {
            $: {
               id: this.uiService.id,
               url: pathUtils.relative(this.dir, this.uiService.path),
               name: this.uiService.name,
            }
         },
         {
            $: {
               id: this.blService.id,
               url: pathUtils.relative(this.dir, this.blService.path),
               name: this.blService.name,
            }
         }
      ];

      await xml.writeXmlFile(this.path, this.ast);
   }
}

module.exports = SbisProject;