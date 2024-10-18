const pMap = require('p-map');
const logger = require('../src/Utils/Logger');
const WasabyCLICommand = require('../src/Utils/WasbyCLIComand');
const {Option} = require('commander');
const initTSEnv = require('./initTSEnv');

const linters = {
    ESLint: require('../src/Linters/ESLint'),
    Stylelint: require('../src/Linters/Stylelint'),
    Prettier: require('../src/Linters/Prettier')
};

const options = [
    new Option(
        '--files <paths...>',
        'Список файлов, по которым запустить линтеры.'
    ),
    new Option(
        '--linters <lintes...>',
        'Список линтеров, которые надо запустить.'
    )
        .choices(Object.keys(linters)),
    ...initTSEnv.options,
];

module.exports = new WasabyCLICommand()
    .name('runLinters')
    .description('Запустить указаные линтеры для переданных файлов.')
    .addOptions(options)
    .action(async(options, project) => {
        const lintersName = options.params.get('linters');
        const files = options.params.get('files');

        if (files.length === 0) {
            return;
        }

        await project.initializeTSEnv([
            project.options.get('resources'),
            project.options.get('builderCache'),
        ], logger.dir);

        try {
            await pMap(lintersName, async(linterName) => {
                if (linters.hasOwnProperty(linterName)) {
                    await project.startLinter(linterName, files);
                }
            }, {
                concurrency: 1,
                stopOnError: false
            });
        } catch (e) {
            // Интересующие нас ошибки уже в консоли, так что AggregateError из p-map просто съедим
            process.exit(-1);
        }
    });