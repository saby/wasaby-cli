const WasabyCLICommand = require('../src/Utils/WasabyCLIComand');
const { Option } = require('commander');
const loadProject = require('./loadProject');
const buildProject = require('./buildProject');
const runUnitTests = require('./runUnitTests');

const ORIGINAL_TASKS = ['load', 'build', 'units'];

const options = [
   new Option(
      '--prePushHooks <taskNames...>',
      'Какие задачи необходимо выполнить в хуке.'
   )
      .choices(ORIGINAL_TASKS),
   ...loadProject.options,
   ...buildProject.options,
   ...runUnitTests.options,
];

module.exports = new WasabyCLICommand()
   .name('runPrePushHook')
   .description('Запускает обработчик для pre-push хука.')
   .addOptions(options)
   .action(async(options, project) => {
      const tasks = options.params.get('prePushHooks');

      if (!(tasks && tasks.length !== 0)) {
         const message = `У вас включён pre-push хук, но не указано в параметре prePushHooks, какие задачи запускать.
           Либо настройте хуки до конца по инструкции https://n.sbis.ru/wasaby-tools/knowledge?article=15bea8b8-69b1-4df5-8e22-e6766dc904a5&published=true&mode=readList,
           Либо выключите хуки, удалив команду wasaby-cli gitInitHooks из package.json и выполнив команду git config --unset core.hooksPath`;

         throw Error(message);
      }

      if (tasks.includes('load')) {
         await project.load();
      }

      if (tasks.includes('build')) {
         await project.build();
      }

      options.params.set('onlyChangedFiles', true);

      if (tasks.includes('units')) {
         await project.runUnitTests();
      }
   });
