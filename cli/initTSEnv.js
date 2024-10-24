const {Option} = require('commander');
const pathUtils = require('../src/Utils/path');
const Config = require('../src/Utils/Config');
const WasabyCLICommand = require('../src/Utils/WasbyCLIComand');

const options = [
    new Option(
        '--workDir <path>',
        'Папка куда будет собран проект.'
    )
        .default(pathUtils.join(process.cwd(), 'application'))
        .argParser(Config.pathParser)
        .hideHelp(),
    // TODO ПО УМОЛЧАНИЮ ВЫНОСИТЬ КЕШ БИЛДЕРА В ПАПКУ С АРТЕФАКТАМИ и удалить от сюда сия параметр
   new Option(
       '--builderCache <path>',
       'Папка кеша сборщика.'
   )
       .default(pathUtils.join(process.cwd(), './build-ui/builder-json-cache'))
       .argParser(Config.pathParser)
       .hideHelp(),
    //TODO удалить, когда все перейдут на eslint
   new Option(
       '--tslint',
       'Устареваший механизм. Использовать tslint вместо eslint. Опция для обратной совместимости.'
   )
       .hideHelp()
];

module.exports = new WasabyCLICommand()
    .name('initTSEnv')
    .description('Настраивает окружения для работы с TypeScript. Устанавливает ESLint, Stylelint, Prettier.')
    .addOptions(options)
    .action(async(options, project) => {
       await project.initializeTSEnv();
    });
