const DemoIndex = require('../src/DemoIndex/DemoIndex');

module.exports = async(options) => {
   const createIndex = new DemoIndex({
      options: options.params
   });

   await createIndex.create();
};
