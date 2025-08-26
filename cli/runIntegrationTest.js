const { Option } = require('commander');

const WasabyCLICommand = require('../src/Utils/WasabyCLIComand');
const pathUtils = require('../src/Utils/path');
const Config = require('../src/Utils/Config');

const options = [
   new Option(
      '--workDir <path>',
      'Папка, где искать модули с тестами.'
   )
      .default(pathUtils.join(process.cwd(), 'wasaby-cli_artifacts', 'PythonTest'))
      .argParser(Config.pathParser),
   new Option(
      '--modules <moduleNames...>',
      'Имена модулей, которые надо протестировать.'
   )
      .default([]),
   new Option(
      '--testPathPattern <String>',
      'Маска для пути по которой будут запущены файлы с тестами.'
   ),
   new Option(
      '--testNamePattern <String>',
      'Маска для имени по которой будут запущены тесты.'
   ),
   new Option(
      '--port <number>',
      'Номер порта на котором поднят стенд'
   )
      .argParser(Config.numberParser),
   new Option('--rootReps <urls...>', 'url-ы репозиториев. Их модули будут протестированы.')
      .default([])
      .hideHelp(),
];

module.exports = new WasabyCLICommand()
   .name('runIntegrationTest')
   .description('Запускает интеграционные тесты проекта.')
   .addOptions(options)
   .action(async(options, project) => {
      await project.runIntegrationTest();
   });
