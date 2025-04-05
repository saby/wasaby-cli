const { Command } = require('commander');
const logger = require('./Logger');
const pathUtils = require('./path');
const NodeJS = require('../Process/NodeJS');
const Config = require('./Config');
const fs = require('fs-extra');
const Repository = require('../Entities/Repository');
const Project = require('../Entities/Project');
const RepositoriesMap = require('../Map/Repositories');
const repositoriesMap = require('../../resources/repositories.json');
const restrictionsReposDefault = require('../../resources/restrictiosRepsDefault.json');

const ignorePaths = [
    '/wasaby-cli_artifacts',
    '/application',
    '/build-ui',
    '/tslint.json',
    '/tslib.js',
    '/wasaby-cli_artifacts',
    '/**/tsconfig.json',
    '/wasabyGlobalTypings.d.ts',
    '/tailwind.config.js',
    '/.eslintrc.js',
    '/.stylelintrc.js',
    '.stylelintignore',
    '/.prettierrc.js',
    '.prettierignore'
];
const isUrl = /(git|ssh|https?|git@[-\w.]+):/;

async function updateGitinore(options) {
    const path = pathUtils.join(options.params.get('gitignorePath') || process.cwd(), '.gitignore');

    if (fs.pathExistsSync(path)) {
        const gitignore = fs.readFileSync(path, 'utf8').trim().split('\n').map(ignorePath => ignorePath.trim());
        let needWrite = false;

        for (const ignorePath of ignorePaths) {
            if (!gitignore.includes(ignorePath)) {
                gitignore.push(ignorePath);
                needWrite = true;
            }
        }

        if (needWrite) {
            await fs.outputFile(path, gitignore.join('\n'));
        }
    } else {
        await fs.outputFile(path, ignorePaths.join('\n'));
    }
}

async function createRep(link, config, versionRequired) {
    if (isUrl.test(link)) {
        const [url, versions] = link.split('#');
        const [version, mergeTarget] = (versions || '').split(':');

        if (versionRequired && !version) {
            return;
        }

        return new Repository({
            url,
            dir: config.params.get('store'),
            protocol: config.params.get('protocol'),
            requiredBranch: version || config.params.get('rc'),
            mergeTarget
        });
    }

    const repInfo = await Repository.getInfo(link);
    return new Repository({
        ...repInfo,
        protocol: config.params.get('protocol'),
        freezeStateOfCommits: true,
        initialized: true,
        requiredBranch: config.params.get('rc')
    });
}

async function prepareRepositories(config) {
    const repositories = new Map();
    const rootRepositories = new Map();
    const userRepos = config.params.get('repositories');
    const rootRepos = config.params.get('rootReps') || [];
    const restrictionsRepos = new Set(restrictionsReposDefault);
    let hasRestrictionsRepos = false;

    for (const link of userRepos) {
        const repository = await createRep(link, config, true);

        if (repository) {
            repositories.set(repository.name, repository);
            restrictionsRepos.add(repository.name);
            continue;
        }

        hasRestrictionsRepos = true;
        restrictionsRepos.add(Repository.getNameFromUrl(link));
    }

    for (const link of rootRepos) {
        const repository = await createRep(link, config);

        if (repositories.has(repository.name)) {
            const rep = repositories.get(repository.name);

            // Версия переданная в rootRepos приоритетнее.
            if (link.includes('#')) {
                rep.requiredBranch = repository.requiredBranch;
            }

            rootRepositories.set(rep.name, rep);
            restrictionsRepos.add(rep.name)

            continue;
        }

        rootRepositories.set(repository.name, repository);
        repositories.set(repository.name, repository);
        restrictionsRepos.add(repository.name)
    }

    // Добавляем в репозитории сам wasaby-cli, чтобы подтянуть из него модули.
    const wasabyCLIRepPath = pathUtils.join(__dirname, '../..');
    const wasabyCLIRep = new Repository({
        url: 'git@git.sbis.ru:saby/wasaby-cli.git',
        dir: pathUtils.dirname(wasabyCLIRepPath),
        name: 'saby_wasaby-cli',
        path: wasabyCLIRepPath,
        protocol: config.params.get('protocol'),
        freezeStateOfCommits: true,
        initialized: true,
        requiredBranch: config.params.get('cliVersion')
    });

    repositories.set(wasabyCLIRep.name, wasabyCLIRep);
    restrictionsRepos.add(wasabyCLIRep.name);

    config.params.set('repositories', repositories);
    config.params.set('rootReps', rootRepositories);

    if (hasRestrictionsRepos) {
        config.params.set('restrictionsReps', restrictionsRepos);
    }
}

class WasabyCLICommand extends Command {
    constructor(name) {
        super(name);

        this.configureHelp({
            showGlobalOptions: true
        });
    }

    hideHelp() {
        this._hidden = true;

        return this;
    }

    getOptionValueSource(optionKey) {
        const result = super.getOptionValueSource(optionKey);

        if (result) {
            return result;
        }

        return this?.parent?.getOptionValueSource(optionKey);
    }

    addOptions(options) {
        for (const option of options) {
            this.addOption(option);
        }

        return this;
    }

    action(callback) {
        super.action(async (userOptions, command) => {
            const config = new Config(command);

            await logger.open({
                dir: pathUtils.join(config.params.get('artifactsDir'), command.name()),
                //TODO Временное решения для тестов по веткам прикладников, сейчас команды запуска пишут сами разработчики
                //  и мы не можем все разом включить тайминги в логах, поэтому смотрим на переменнуб окружения,
                //  которую выставляют сборщики.
                //  Убрать когда пересадим прикладников на единые рельсы и сможем передавать это параметром.
                enableLabels: !!process.env.WASABY_CLI_ENABLE_LABELS || !config.params.get('isLocaleProject'),
                console: {
                    level: config.params.get('consoleLevel')
                }
            });

            await NodeJS.checkSupport();

            await logger.writeFile('WasabyCliConfig.json', config.toString());

            // Параметр, чтобы не терялись цвета в сообщения из child_process.
            if (config.params.get('isLocaleProject')) {
                process.env.FORCE_COLOR = true;
            }

            await prepareRepositories(config);

            const configProject = {
                options: config.params,
                repository: {}
            };

            if (config.params.get('isLocaleProject')) {
                configProject.repository = new Repository(await Repository.getInfo(process.cwd()));
            }

            const project = new Project(configProject);

            if (config.params.get('isLocaleProject')) {
                await updateGitinore(config);
            }

            await callback(config, project, this);
        });

        return this;
    }
}

module.exports = WasabyCLICommand;