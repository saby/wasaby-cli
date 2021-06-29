const open = require('open');

const SourceCodeStore = require('./../app/store');
const Build = require('./../app/build');
const Prepare = require('./../app/prepare');
const app = require('./../app/app');
const DemoIndex = require('./../src/DemoIndex/DemoIndex');

module.exports = async (options) => {
   const store = new SourceCodeStore({
      options: options.params
   });

   await store.run();

   const makeTsConfig = new Prepare({
      options: options.params
   });

   await makeTsConfig.run();

   const build = new Build({
      options: options.params
   });

   await build.run();

   const createIndex = new DemoIndex({
      options: options.params
   });

   await createIndex.create();

   const url = await app.run(options.params);

   open(url);

   await build.startWatcher();
}
