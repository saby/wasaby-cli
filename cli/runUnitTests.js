const { Option } = require('commander');

const WasabyCLICommand = require('../src/Utils/WasbyCLIComand');
const pathUtils = require('../src/Utils/path');
const Config = require('../src/Utils/Config');

const options = [
   new Option(
       '--workDir <path>',
       'Папка, где искать модули с юнит-тестами.'
   )
       .default(pathUtils.join(process.cwd(), 'application'))
       .argParser(Config.pathParser),
   new Option(
       '--rep <repositoryNames...>',
       'Имена репозиториев. Их модули будут протестированы.'
   )
       .default([]),
   new Option(
       '--modules <moduleNames...>',
       'Имена модулей, которые надо протестировать.'
   )
       .default([]),
   new Option(
       '--report <type>',
       'Куда вывести отчёт.'
   )
       .choices(['xml', 'console'])
       .default('xml'),
   new Option(
       '--testPathPattern <String>',
       'Параметр для Jest. Маска для пути по которой будут запущены файлы с тестами.'
   ),
   new Option(
       '--runTestsByPath <String>',
       'Параметр для Jest. Запускать только те тесты, которые были указаны с точными путями.'
   ),
   new Option(
       '--testNamePattern <String>',
       'Параметр для Jest. Маска для имени по которой будут запущены тесты.'
   ),
   new Option(
       '--updateSnapshot',
       'Параметр для Jest. Включает режим обновления снапшотов.'
   ),
   new Option(
       '--runInBand',
       'Параметр для Jest. Запускает тесты последовательно.'
   ),
   new Option(
       '--detectOpenHandles',
       'Параметр для Jest. Отслеживает потенциальные утечки.'
   ),
   new Option(
       '--testTimeout <number>',
       'Параметр для Jest. Допустимое время на прохождение одного тесткейса.'
   ),
   new Option(
       '--maxWorkers <String>',
       'Параметр для Jest. Задает максимальное количество рабочих поток, выделяемых при выполнении тестов. Опцию необходимо задавать вместе с --workerIdleMemoryLimit.'
   )
       .hideHelp(),
   new Option(
       '--workerIdleMemoryLimit <String>',
       'Параметр для Jest. Задает максимальное количество памяти, которое может использовать рабочий поток. Опцию необходимо задавать вместе с --maxWorkers.'
   )
       .hideHelp(),
   new Option(
       '--reporters <repotres...>',
       'Параметр для Jest. Запустите тесты с указанными репортерами.'
   )
       .hideHelp(),
   new Option(
       '--colors',
       'Параметр для Jest. Принудительно подсвечивает результаты теста, даже если stdout не является TTY.'
   )
       .hideHelp(),
   new Option(
       '--verbose',
       'Параметр для Jest. Отображение результатов отдельных тестов с помощью иерархии тестовых наборов.'
   )
       .hideHelp(),
   new Option(
       '--coverage',
       'Сгенерировать отчет покрытия.'
   ),
   new Option(
       '--coveredModules <moduleNames...>',
       'Параметр для Mocha. Имена модулей, по которые надо построить покрытие. По умолчанию все модули, от которых зависит модуль с тестами.'
   ),
   new Option(
       '--timeoutTests <number>',
       'Максимально допустипое время выполнения одного тест кейса в милисекундах.'
   )
       .argParser(Config.numberParser),
   new Option(
       '--parallelNodeJSTest <number>',
       'Сколько модулей под Node.js тестировать в паралель.'
   )
       .default(1)
       .argParser(Config.numberParser),
   new Option(
       '--parallelJSDOMTest <number>',
       'Сколько модулей под JSOM тестировать в паралель.'
   )
       .default(1)
       .argParser(Config.numberParser),
   new Option(
       '--grep <RegExp>',
       'Параметр для Mocha. Запустить тесты соответствующие регулярному выражению.'
   ),
   new Option(
       '--server',
       'Запускает сервер для юнит-тестов, сами юниты-тесты не выполняются.'
   ),
   new Option(
       '--ide <type>',
       'Параметр запуска тестов на Jest из IDE.'
   )
       .choices(['WebStorm']),
   new Option(
       '--disableConsoleFilter',
       'Отключает фильтрацию ошибок в консоль. Любая ошибка в консоли будет приводить к падению тестов.'
   ),
   new Option(
       '--NodeJS',
       'Запускает тесты под Node.js'
   )
       .hideHelp(),
   new Option(
       '--JSDOM',
       'Запускает тесты под JSDOM'
   )
       .hideHelp(),
   new Option(
       '--port <number>',
       'Сколько модулей под Node.js тестировать в паралель.'
   )
       .argParser(Config.numberParser)
       .hideHelp(),
   new Option(
       '--dependentModules',
       'Построить дерево на вверх'
   )
       .hideHelp(),
];

module.exports = new WasabyCLICommand()
    .name('runUnitTests')
    .description('Запускает юнит-тесты проекта.')
    .addOptions(options)
    .action(async(options, project) => {
       await project.runUnitTests();
    });
