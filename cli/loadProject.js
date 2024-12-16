const { Option } = require('commander');

const WasabyCLICommand = require('../src/Utils/WasbyCLIComand');

const options = [
    new Option(
        '--rc <rcBranch>',
        'Имя ветки которая будет использоваться как дефолтная, по умолчанию берется из параметра version в package.json'
    ),
    new Option(
        '--rep <repositoryNames...>',
        'Имена репозиториев. Их модули, будут считаться корневыми в проекте.'
    )
        .default([]),
    new Option(
        '--modules <moduleNames...>',
        'Имена модулей, которые будут корневыми в проекте.'
    )
        .default([]),
    new Option(
        '--protocol <type>',
        'По какому протколу скачивать репозиторий'
    )
        .choices(['ssh', 'https'])
        .default('ssh'),
    new Option(
        '--dependentModules',
        'Построить дерево на вверх'
    )
        .hideHelp(),
];

module.exports = new WasabyCLICommand()
    .name('loadProject')
    .description('Выкачивает репозитории с модулями необходимыми для сборки проекта.')
    .addOptions(options)
    .action(async(options, project) => {
        await project.load();
    });
