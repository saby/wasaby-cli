const pMap = require('p-map');

const ChildProcess = require('../src/Utils/ChildProcess');

const originalHooks = {
   ESLint: require('../src/Linters/ESLint'),
   Stylelint: require('../src/Linters/Stylelint'),
   Prettier: require('../src/Linters/Prettier')
};

module.exports = async(options, project) => {
   const hooksNames = options.params.get('preCommitHooks');
   const changedFiles = (await project.repository.getNotCommittedFiles()).changed;

   if (changedFiles.length === 0) {
      return;
   }

   await project.initializeTSEnv();

   try {
      await pMap(hooksNames, async(hookName) => {
         if (originalHooks.hasOwnProperty(hookName)) {
            await project.startLinter(hookName, changedFiles);

            return;
         }

         const userHook = new ChildProcess({
            commandLine: hookName
         });

         await userHook.run();
      }, {
         concurrency: 1,
         stopOnError: false
      });
   } catch (e) {
      // Интересующие нас ошибки уже в консоли, так что AggregateError из p-map просто съедим
      process.exit(-1);
   }
};
