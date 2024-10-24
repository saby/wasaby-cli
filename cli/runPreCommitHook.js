const pMap = require('p-map');

const ChildProcess = require('../src/Process/ChildProcess');
const WasabyCLICommand = require('../src/Utils/WasbyCLIComand');
const { Option } = require('commander');
const initTSEnv = require('./initTSEnv');

const originalHooks = {
   ESLint: require('../src/Linters/ESLint'),
   Stylelint: require('../src/Linters/Stylelint'),
   Prettier: require('../src/Linters/Prettier')
};

const options = [
   new Option(
       '--preCommitHooks <lintes...>',
       'Список обработчиков, которые надо запустить.'
   )
       .choices(Object.keys(originalHooks)),
    ...initTSEnv.options,
];

module.exports = new WasabyCLICommand()
    .name('runPreCommitHook')
    .description('Запускает обработчик для pre-commit хука. Предварительно запускает команду initTSEnv')
    .addOptions(options)
    .action(async(options, project) => {
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
    });
