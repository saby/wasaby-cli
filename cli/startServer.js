const DemoIndex = require('../src/DemoIndex/DemoIndex');

module.exports = async(options, project) => {
   const createIndex = new DemoIndex({
      options: options.params
   });

   await createIndex.create();

   await project.startServer();
};
