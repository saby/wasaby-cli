const pMap = require('p-map');
const logger = require('../src/Utils/Logger');

const linters = {
    ESLint: require('../src/Linters/ESLint'),
    Stylelint: require('../src/Linters/Stylelint'),
    Prettier: require('../src/Linters/Prettier')
};

module.exports = async(options, project) => {
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
};