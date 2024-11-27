const WasabyCLICommand = require("../src/Utils/WasbyCLIComand");
const {Option} = require("commander");
const pathUtils = require("../src/Utils/path");
const Config = require("../src/Utils/Config");

const options = [
    new Option(
        '--workDir <path>',
        'Папка, где искать модули с тестами.'
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
        'Маска для пути по которой будут запущены файлы с тестами.'
    ),
    new Option(
        '--testNamePattern <String>',
        'Маска для имени по которой будут запущены тесты.'
    ),
    new Option(
        '--exclude <TestNames...>',
        'Полные имена тестов которые надо исключить.'
    ),
    new Option(
        '--include <TestNames...>',
        'Полные имена тестов которые надо запустить.'
    ),
    new Option(
        '--onlyFailed',
        'Запустить только упавшие тесты. Если отчёта с предыдущего запуска нет, запустит все.'
    ),
    new Option(
        '--waitForTimeout <number>',
        'Таймаут в миллисекундах для всех команд waitForXXX.'
    )
        .default(5000),
    new Option(
        '--mochaTimeout <number>',
        'Максимально допустимое время выполнения теста. По умолчанию отключён.'
    ),
    new Option(
        '--maxInstances <number>',
        'Количество одновременно обрабатываемых тестовых файлов.'
    )
        .default(1),
    new Option(
        '--logLevel <type>',
        'Уровень логирования для Builder'
    )
        .choices(['error', 'info'])
        .default('error'),
    new Option(
        '--driverPort <number>',
        'Порт для веб драйвера.'
    )
        .hideHelp(),
    new Option(
        '--screenshotsDir <path>',
        'Путь до папки, куда складывать скриншоты.'
    )
        .argParser(Config.pathParser),
    new Option(
        '--browserLogsDir <path>',
        'Путь до папки, кужа склыдвать логи браузера.'
    )
        .argParser(Config.pathParser),
];

module.exports = new WasabyCLICommand()
    .name('runBrowserTests')
    .description('Команда обновляет карту модулей в wasaby-cli')
    .hideHelp()
    .addOptions(options)
    .action(async(options, project) => {
       await project.runBrowserTests();
    });
