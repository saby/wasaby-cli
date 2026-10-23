const Module = require('../src/Module/Module');
const pathUtils = require('../src/Utils/path');
const createGuid = require('../src/Utils/createGuid');
const WasabyCLICommand = require('../src/Utils/WasabyCLIComand');
const {Option} = require('commander');
const Config = require('../src/Utils/Config');

const options = [
   new Option(
       '--path <path>',
       'Путь до создаваемого модуля.'
   )
       .makeOptionMandatory()
       .argParser(Config.pathParser),
   new Option(
       '--kaizen <GUID>',
       'Индефикатор кайдзена, к которому относится модуль.'
   )
       .makeOptionMandatory(),
   new Option(
       '--responsible <String>',
       'ФИО ответственого за модуль.'
   )
       .makeOptionMandatory(),
    new Option(
        '--responsibleId <GUID>',
        'Индефикатор ответственого за модуль.'
    )
        .makeOptionMandatory(),
   new Option(
      '--package <String>',
      'Имя пакета'
   ),
   new Option(
       '--type <type>',
       'Тип модуля.'
   )
       .choices(['ui', 'test', 'demo'])
       .default('ui'),
   new Option(
       '--environment <type>',
       'В каком окружении запускать тесты.'
   )
       .choices(['NodeJS', 'Browser'])
       .default('NodeJS'),
   new Option(
      '--enableAutodoc',
      'Включить сборку автодоки для модуля.'
   )
      .default(false),
];

module.exports = new WasabyCLICommand()
    .name('createModule')
    .description('Создаёт модуль')
    .addOptions(options)
    .action(async(options) => {
       let config;

       switch (options.params.get('type')) {
          case 'test': {
             config = {
                type: 'test',
                environment: options.params.get('environment'),
                repository: {
                   name: 'createModule'
                }
             };

             break;
          }
          case 'demo': {
             config = {
                type: 'demo'
             };

             break;
          }
          default: {
             config = {
                type: 'ui'
             };
          }
       }

       config.kaizen = {
          id: options.params.get('kaizen'),
          responsible: options.params.get('responsible'),
          responsibleUuid: options.params.get('responsibleId')
       };
       config.path = options.params.get('path');
       config.name = pathUtils.basename(config.path);
       config.s3mod = pathUtils.join(config.path, config.name + '.s3mod');
       config.id = createGuid();
       config.forCDN = options.params.get('cdn');
       config.typescript = {
           typecheck: '1'
       };
       config.enableAutodoc = options.params.get('enableAutodoc');
       config.package = options.params.get('package');

       const module = Module.buildModuleFromObject(config);

       await module.save();
    });
