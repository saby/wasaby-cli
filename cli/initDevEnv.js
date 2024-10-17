const open = require('open');

const DemoIndex = require('./../src/DemoIndex/DemoIndex');

module.exports = async(options, project) => {
   options.params.set('hotReload', true);

   await project.load();

   await project.initializeTSEnv();

   await project.build();

   const createIndex = new DemoIndex({
      options: options.params
   });

   await createIndex.create();

   await project.startServer();

   const onChangeCallback = async() => {
      await project.server.restart();
   };

   open(project.server.rootUrl);

   await project.runWatcher(onChangeCallback);
};
