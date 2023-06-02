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

   await pMap(hooksNames, async(hookName) => {
      if (hookName === 'Prettier') {
         // TODO: https://online.sbis.ru/opendoc.html?guid=e1fa78a8-ceae-443e-926f-4ff027df3343&client=3
         // по этой задаче в 23.3000 нужно будет прогнать форматирование всем и вернуть хук
         return;
      }
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
};
