const { Option } = require('commander');
const Config = require('../src/Utils/Config');
const pathUtils = require('../src/Utils/path');
const WasabyCLICommand = require("../src/Utils/WasbyCLIComand");

const options = [
   new Option(
       '--workDir <path>',
       'Папка куда будет собран проект.'
   )
       .default(pathUtils.join(process.cwd(), 'application'))
       .argParser(Config.pathParser),
   new Option(
       '--builderCache <path>',
       'Папка кеша сборщика.'
   )
       .default(pathUtils.join(process.cwd(), './build-ui/builder-json-cache'))
       .argParser(Config.pathParser),
   new Option(
       '--rep <repositoryNames...>',
       'Имена репозиториев. Их модули будут считаться корневыми в проекте.'
   )
       .default([]),
   new Option(
       '--modules <moduleNames...>',
       'Имена модулей, которые будут корневыми в проекте.'
   )
       .default([]),
   new Option(
       '--localization <langCodes...>',
       'Список кодов доступных языков. Первый язык из списка будет дефолтным. Пример кода для английского: en.'
   ),
   new Option(
       '--countries <regionCodes...>',
       'Список кодов доступных регионов. Пример кода для казахстана: KZ.'
   ),
   new Option(
       '--watcher',
       'Запустить отслеживания изменений в файлах для пересборки их на лету.'
   ),
   new Option(
       '--copy',
       'Копировать ресурсы, по умолчанию создаются симлинки.'
   ),
   new Option(
       '--hotReload',
       'Запустить сервер hotReload-а и отслеживания изменений в файлах.'
   )
       .implies({ watcher: true }),
   new Option(
       '--hotReloadPort <number>',
       'Порт на котором будет поднят сервер для HotReload-а. Если порт будет занят сгенерируется другой.'
   )
       .default(3000)
       .argParser(Config.numberParser),
   new Option(
       '--release',
       'Собрать стенд в релиз режиме, собрать пакеты и минифицировать ресурсы.'
   ),
   new Option(
       '--umd',
       'Собирать в UMD.'
   ),
   new Option(
       '--inlineSourceMaps',
       'Добавлять source map при сборке.'
   ),
   new Option(
       '--onlyChanges',
       'Собрать только измененёные файлы'
   ),
   new Option(
       '--disableSources',
       'Опция отключает копирование исходных файлов.'
   ),
   new Option(
       '--esVersion <number>',
       'Версия спецификации для ECMAScripts.'
   )
       .default(2019)
       .argParser(Config.numberParser),
   new Option(
       '--logLevel <type>',
       'Уровень логирования для Builder'
   )
       .choices(['error', 'info', 'warning', 'debug'])
       .default('info'),
   new Option(
       '--maxWorkers <number>',
       'Максимальное количество воркерок, которые может использовать Builder. По умолчанию количество ядер минус одно.'
   )
       .argParser(Config.numberParser),
   new Option(
       '--force',
       'Игнорировать ошибки сборки и не прерывать дальнейшие команды. Мы настоятельно не рекомендуем использовать данный флаг, игнорирование ошибок сборки может привести к ошибкам в дальнейших командах.'
   ),
   new Option(
       '--buildTools <type>',
       'Какой инстурмент будет использоваться для сборки.'
   )
       .choices(['builder', 'jinnne'])
       .default('builder')
       .hideHelp(),
   new Option(
       '--projectDir <path>',
       'Путь до собираемяего проекта (s3cld).'
   )
       .argParser(Config.pathParser)
       .implies({ buildTools: 'jinnne' })
       .hideHelp(),
   new Option(
       '--hooksPath <path>',
       'Путь до файла с хуками для Builder.'
   )
       .argParser(Config.pathParser)
       .hideHelp(),
   new Option(
       '--pythonTestDir <path>',
       'Путь до файла с хуками для Builder.'
   )
       .argParser(Config.pathParser)
       .hideHelp(),
   new Option(
       '--pathToSDK <path>',
       'Путь до SDK.'
   )
       .argParser(Config.pathParser)
       .hideHelp(),
   new Option(
       '--extensionForTemplate <extension>',
       'Какое расширение использовать для шаблонов.'
   )
       .choices(['js'])
       .hideHelp(),
   new Option(
       '--dependentModules',
       'Построить дерево на вверх'
   )
       .hideHelp(),
   new Option(
       '--debug',
       'Собрать в debug'
   )
       .hideHelp(),
];

module.exports = new WasabyCLICommand()
    .name('buildProject')
    .description('Компилирует модули проекта.')
    .addOptions(options)
    .action(async(options, project) => {
       await project.build();

       if (options.params.get('watcher')) {
          await project.runWatcher();
       }
    });
