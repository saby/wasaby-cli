const Module = require('../src/Module/Module');
const pathUtils = require('../src/Utils/path');
const createGuid = require('../src/Utils/createGuid');

module.exports = async(options) => {
   let config;

   switch (options.params.get('type')) {
      case 'test': {
         config = {
            type: 'test',
            environment: options.params.get('environment'),
            repository: {
               name: 'createModule'
            }
         };

         break;
      }

      default: {
         config = {
            type: 'ui'
         };
      }
   }

   config.path = options.params.get('path');
   config.name = pathUtils.basename(config.path);
   config.s3mod = pathUtils.join(config.path, config.name + '.s3mod');
   config.id = createGuid();
   config.forCDN = options.params.get('cdn');

   const module = Module.buildModuleFromObject(config);

   await module.save();
};
