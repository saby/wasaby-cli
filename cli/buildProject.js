module.exports = async(options, project) => {
   await project.build();

   if (options.params.get('watcher')) {
      await project.runWatcher();
   }
};
