const fs = require('fs-extra');
const pMap = require('p-map').default;
const pathUtils = require('../Utils/path');
const ModuleManager = require('./ModuleManager');
const Repository = require('../Entities/Repository');
const Directory = require('../Entities/Directory');
const logger = require('../Utils/Logger');
const Module = require('../Module/Module');
const ChildProcess = require('../Process/ChildProcess');

const PROJECT_ID_FOR_MM = '15f56b61-6663-49af-ae70-f09eaa661fd0';

// Нам нужно всегда грузить все cdn модули, потому ни кто не указывает их в зависимостях.
// Для этого запросит от Module Manager информацию по одному модулю из каждого cdn репозитория, но вычитаем от туда все.
const CDN_MODULES = [
    // https://git.sbis.ru/saby/wasaby-cdn.git
    '60e42987-4d2c-4455-a254-97257c2314d6',
    // https://git.sbis.ru/engine/cdn.git
    '6e2c351e-fc7c-4bed-b718-e2eb28ac3d0e',
    // https://git.sbis.ru/sbis/cdn.git
    'ed17c631-6d03-4913-8c5d-e2081c398774',
    // https://git.sbis.ru/online/cdn.git
    'fd701948-fd2c-489b-a514-e958418882f4',
    // https://git.sbis.ru/buh/cdn
    'abb76d91-0ab9-4b01-a450-f7d987e161ef',
    // https://git.sbis.ru/staff/cdn/
    '16101687-c917-4c58-9483-f9104c0c7a5a',
    // https://git.sbis.ru/video/cdn.git
    '922fbb7a-1198-45ba-9bb1-a1a5da1d3468',
];

const DEFAULT_MODULES = [
    // Typescript
    '0e6a9dbb-14e5-4382-9430-b6e73a53dc79',
    // ThemeModules
    'f515eba2-dad5-4cc3-bef8-2ff45bd2a880',
];

class Store {
    constructor(path, options, disablePreClean) {
        this.path = path;
        this.cachePath = pathUtils.join(this.path, 'store.json');
        this.pathLockFile = pathUtils.join(this.path, 'lockfile.json');
        this.protocol = options.get('protocol');
        this.loadFullHistory = options.get('loadFullHistory') || false;
        this.concurrencyLoadRepos = options.get('loadFullHistory') ? 3 : 8;
        this.filterReps = options.get('restrictionsReps');
        this.preClean = !disablePreClean;
        this.disableModuleManager = options.get('disableModuleManager');
        this.modules = new Map();
        this.repositories = new Map();

        if (options.get('restrictionsForStore')) {
            this.whiteList = require(options.get('restrictionsForStore'));
            this.filterReps = new Set([pathUtils.basename(pathUtils.join(__dirname, '../..'))]);

            for (const url of Object.keys(this.whiteList)) {
                this.filterReps.add(Repository.getNameFromUrl(url));
            }
        }

        if (fs.pathExistsSync(this.cachePath)) {
            try {
                this.readCache(this.filterReps);
            } catch (err) {
                logger.debug(`Кеш хранилища невалидный. Error: ${err.stack}`);
            }
        }
    }

    readCache(filterReps) {
        const { repositories, modules } = require(this.cachePath);
        const whiteListReps = filterReps || new Set(Object.keys(repositories));

        for (const repository of Object.values(repositories)) {
            if (whiteListReps.has(repository.name)) {
                if (repository.type === 'Repository') {
                    this.repositories.set(repository.name, new Repository(repository));
                } else {
                    this.repositories.set(repository.name, new Directory(repository.path));
                }
            }
        }

        for (const moduleInfo of Object.values(modules)) {
            if (whiteListReps.has(moduleInfo.repository)) {
                const module = Module.buildModuleFromObject(moduleInfo);

                module.repository = this.repositories.get(module.repository);

                this.modules.set(module.id, module);
            }
        }
    }

    async loadModules(version, rootModules) {
        if (this.disableModuleManager) {
            return;
        }

        const loadedModule = new Map();
        const ids = new Set();

        for (const module of [...CDN_MODULES, ...DEFAULT_MODULES, ...rootModules]) {
            if (typeof module === 'string') {
                if (this.modules.has(module)) {
                    loadedModule.set(module, this.modules.get(module));
                } else {
                    ids.add(module);
                }

                continue;
            }

            loadedModule.set(module.id, module);
        }

        const { unknownModules } = this.getDependencies(loadedModule, {
            modules: loadedModule,
            errors: new Set(),
            unknownModules: ids
        });

        const modules = await ModuleManager.getDepsList(version, [...unknownModules]);
        const repositories = new Map();

        for (const module of modules.values()) {
            const storeModule = this.modules.get(module.Id);

            if (storeModule && !storeModule.shortHash && module.Hash) {
                storeModule.shortHash = module.Hash;
            }

            if (!repositories.has(module.GitUrl)) {
                const repository = new Repository({
                    protocol: this.protocol,
                    url: module.GitUrl,
                    dir: this.path,
                    requiredBranch: module.GitBranch
                });

                repositories.set(module.GitUrl, repository);
            }
        }

        await this.loadRepositories(repositories, modules);
    }

    async loadRepositories(repositories, MMModules = new Map()) {
        await pMap(repositories.values(), async(repository) => {
            if (repository instanceof Repository) {
                if (this.whiteList && !this.whiteList.hasOwnProperty(repository.https)) {
                    return;
                }

                if (this.repositories.has(repository.name)) {
                    return;
                }

                repository.loadHistory = this.loadFullHistory;

                await repository.install(this.preClean);

                const repModules = await repository.getModules();
                const whiteListModules = this.whiteList?.[repository.https] || [];

                for (const module of repModules) {
                    if (this.modules.has(module.id)) {
                        continue;
                    }

                    if (whiteListModules.length !== 0 && !whiteListModules.includes(module.id)) {
                        continue;
                    }

                    if (module.isSuperbundles()) {
                        continue;
                    }

                    module.shortHash = MMModules.get(module.id)?.Hash;

                    this.modules.set(module.id, module);
                }

                this.repositories.set(repository.name, repository);

                return;
            }

            if (repository instanceof Directory) {
                const repModules = await repository.getModules();

                for (const module of repModules) {
                    if (!this.modules.has(module.id)) {
                        this.modules.set(module.id, module);
                    }
                }

                this.repositories.set(repository.name, repository);
            }
        }, {
            concurrency: this.concurrencyLoadRepos
        });
    }

    getMetainfoMM(rootModules) {
        const result = {};

        if (rootModules) {
            result[PROJECT_ID_FOR_MM] = {
                name: 'wasaby-cli',
                type: 'Service',
                git_path: 'wasaby-cli',
                path: 'wasaby-cli',
                url: 'https://git.sbis.ru/saby/wasaby-cli.git',
                rev: '',
                short_id: '',
                deps: [...rootModules.keys()],
                parent: [],
            };
        }

        for (const values of this.modules) {
            const [id, module] = values;
            const parent = [...this.getDependedModules(new Map([values])).keys()];

            result[id] = {
                name: module.name,
                type: 'UI Module',
                git_path: module.path.replace(`${module.repository.path}/`, ''),
                path: module.path.replace(`${module.repository.dir}/`, ''),
                url: `${module.repository.https}.git`,
                rev: module.repository.HEAD || '',
                short_id: '',
                deps: Object.keys(module.depends),
                parent,
            };
        }

        return result;
    }

    async save(rootModules) {
        const serializeCache = JSON.stringify(this.serialize(), null, 3);
        const serializeMMMeta = JSON.stringify(this.getMetainfoMM(rootModules), null, 3);

        await Promise.all([
            fs.outputFile(this.cachePath, serializeCache),
            logger.writeFile('store.json', serializeCache),
            fs.outputFile(pathUtils.join(this.path, 'metainfo.json'), serializeMMMeta),
            logger.writeFile('metainfo.json', serializeMMMeta)
        ]);
    }

    clear() {
        this.repositories = new Map();
        this.modules = new Map();
    }

    getModules(filter = {}) {
        const result = new Map();
        const filterForModule = {...filter};

        delete filterForModule.fullDepsTree;

        for (const [id, module] of this.modules) {
            if (module.isMatchedFilter(filterForModule)) {
                if (filter.fullDepsTree) {
                    if (this.getDependencies(new Map([[id, module]])).errors.size === 0) {
                        result.set(id, module);
                    }

                    continue;
                }

                result.set(id, module);
            }
        }

        return result;
    }

    getDependedModules(modules, filter = {}, checkRepository) {
        const result = new Map();

        for (const module of this.modules.values()) {
            let isBadModule = false;

            for (const [name, values] of Object.entries(filter)) {
                if (!values.includes(module[name])) {
                    isBadModule = true;

                    break;
                }
            }

            if (isBadModule) {
                continue;
            }

            const isATFTest = module.type === 'test'
               && module.framework === 'ATF'
               && module.environment === 'Python';

            for (const id of Object.keys(module.depends)) {
                if (!modules.has(id)) {
                    continue;
                }

                const dep = modules.get(id);
                const isOneRepository = dep.repository === module.repository || !checkRepository;

                if (isOneRepository || isATFTest) {
                    result.set(module.id, module);

                    break;
                }
            }
        }

        return result;
    }

    getDependencies(
       rootModules,
       info = {
           modules: new Map([...rootModules]),
           errors: new Set(),
           unknownModules: new Set()
       }
    ) {
        for (const module of info.modules.values()) {
            for (const [depID, depName] of Object.entries(module.depends)) {
                if (!info.modules.has(depID)) {
                    if (this.modules.has(depID)) {
                        info.modules.set(depID, this.modules.get(depID));

                        this.getDependencies(info.modules, info);
                    } else {
                        info.unknownModules.add(depID);
                        info.errors.add(`Module ${depName}(${depID}) not found. Module is specified in dependencies of module ${module.name}(${module.id})`);
                    }
                }
            }
        }

        return info;
    }

    async loadShortHashForModules() {
        const modulesWithoutHash = [];

        for (const module of this.modules.values()) {
            if (module.type !== 'test' && !module.shortHash) {
                modulesWithoutHash.push(module.id);
            }
        }

        const hashes = await ModuleManager.getShortHashForModules(modulesWithoutHash);

        for (const [id, hash] of Object.entries(hashes)) {
            const module = this.modules.get(id);

            // Метод может вернут чудесным образом id модуляю, которого не было в списке, приходиться защищаться от этого
            if (module) {
                module.shortHash = hash;
            }
        }
    }

    serialize() {
        const modules = {};
        const repositories = {};

        for (const [id, module] of this.modules) {
            modules[id] = module.serialize();
        }

        for (const [name, repository] of this.repositories) {
            repositories[name] = repository.serialize();
        }

        return {
            repositories,
            modules
        };
    }

    async lock() {
        if (fs.pathExistsSync(this.pathLockFile)) {
            const data = require(this.pathLockFile);

            if (await ChildProcess.isProcessAlive(data.pid)) {
                throw new Error(`The repository store at ${this.path} is locked by the process "${data.command}" running from the directory ${data.cwd}`);
            }
        }

        const lockData = {
            pid: process.pid,
            command: process.argv.join(' '),
            cwd: process.cwd(),
        };

        await fs.outputFile(this.pathLockFile, JSON.stringify(lockData, null, 3));
    }
}

module.exports = Store;