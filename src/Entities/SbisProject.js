const pathUtils = require('../Utils/path');
const xml = require('../Utils/xml');
const Service = require('../Entities/Service');
const pMap = require('p-map').default;

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

      for (const {$: info} of this.ast.cloud.items[0].service) {
         if (info.url.endsWith('UI.s3srv')) {
            this.uiService = new Service(pathUtils.join(this.dir, info.url), this.sdkPath);
         } else {
            this.blService = new Service(pathUtils.join(this.dir, info.url), this.sdkPath);
         }
      }
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

      const uiServices = await this.uiService.getAllService();
      const blServices = await this.blService.getAllService();
      const services = uiServices.union(blServices);

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