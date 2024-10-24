const DemoIndex = require('../src/DemoIndex/DemoIndex');
const WidgetsShop = require('../src/DemoIndex/WidgetsShop');
const WasabyCLICommand = require("../src/Utils/WasbyCLIComand");
const {Option} = require("commander");
const pathUtils = require("../src/Utils/path");
const Config = require("../src/Utils/Config");

const options = [
    new Option(
        '--workDir <path>',
        'Папка со скомпилированным проектом. Она будет использоваться для раздачи статики.'
    )
        .default(pathUtils.join(process.cwd(), 'application'))
        .argParser(Config.pathParser),
    new Option(
        '--port <number>',
        'Порт на котором будет поднят сервер. Если порт будет занят сгенерируется другой.'
    )
        .default(1024)
        .argParser(Config.numberParser),
    new Option(
        '--release',
        'Сервер сможет отдавать минифицированые и спакованные ресурсы. Чтобы это работало ресурсы должны быть собраны в релизе.'
    ),
    new Option(
        '--https',
        'Включает https протокол для стенда'
    ),
    new Option(
        '--browserCache',
        'Включает кеширование браузера для стенда. Чтобы кеширование заработало для https в chrome сертификат придётся добавить в доверенные. https://bugs.chromium.org/p/chromium/issues/detail?id=110649#c8'
    ),
    new Option(
        '--expressRoute <object>',
        'Объект содержащий пути до пользовательских роутингов для express.'
    )
        .argParser((value) => JSON.parse(value)),
    new Option(
        '--routePrefix <string>',
        'Префикс для роутинга.'
    )
        .argParser((value) => JSON.parse(value))
        .hideHelp(),
];

module.exports = new WasabyCLICommand()
    .name('startServer')
    .description('Запускает демо стенд на express. Предварительно запускает команду buildDemoIndex.')
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

        await project.startServer();
    });
