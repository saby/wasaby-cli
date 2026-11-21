const pMap = require('p-map').default;

const ChildProcess = require('../src/Process/ChildProcess');
const WasabyCLICommand = require('../src/Utils/WasabyCLIComand');
const { Option } = require('commander');
const initTSEnv = require('./initTSEnv');

const originalHooks = {
   ESLint: require('../src/Linters/ESLint'),
   Stylelint: require('../src/Linters/Stylelint'),
   Prettier: require('../src/Linters/Prettier'),
   TypesValidity: require('../src/Linters/TypesValidity'),
   AmbiguousNames: require('../src/Linters/AmbiguousNames')
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

       if (!(hooksNames && hooksNames.length !== 0)) {
          const message = `У вас включён pre-commit хук, но не указано в параметре preCommitHooks, какие линтеры запускать.
           Либо настройте хуки до конца по инструкции https://n.sbis.ru/wasaby-tools/knowledge?article=15bea8b8-69b1-4df5-8e22-e6766dc904a5&published=true&mode=readList,
           Либо выключите хуки, удалив команду wasaby-cli gitInitHooks из package.json и выполнив команду git config --unset core.hooksPath`;

          throw Error(message);
       }

       const changedFiles = (await project.repository.getNotCommittedFiles()).changed
          .filter((filePath) => !filePath.includes('/third-party/'));

       if (changedFiles.length === 0) {
          return;
       }

       await project.initializeTSEnv(options);

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
