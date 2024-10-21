const DemoIndex = require('../src/DemoIndex/DemoIndex');
const WidgetsShop = require('../src/DemoIndex/WidgetsShop');
const WasabyCLICommand = require('../src/Utils/WasbyCLIComand');
const {Option} = require('commander');
const pathUtils = require('../src/Utils/path');
const Config = require('../src/Utils/Config');

const options = [
   new Option(
       '--workDir <path>',
       'Папка со скомпилированным проектом. В ней будут искать модули с демо примером.'
   )
       .default(pathUtils.join(process.cwd(), 'application'))
       .argParser(Config.pathParser),
   new Option(
       '--modules <moduleNames...>',
       'Для каких модулей построить разводящую. По умолчанию строиться для всех демо модулей в проекте.'
   )
];

module.exports = new WasabyCLICommand()
    .name('buildDemoIndex')
    .description('Генерирует разводящую страницу для демо-примеров.')
    .hideHelp()
    .addOptions(options)
    .action(async(options, project) => {
       const createIndex = new DemoIndex({
          options: options.params
       });
       const widgetsShop = new WidgetsShop({
          options: options.params
       });

       await Promise.all([
          createIndex.create(),
          widgetsShop.create()
       ]);

       await createIndex.create();
    });
