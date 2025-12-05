const fs = require('fs-extra');
const pMap = require('p-map');
const pathUtils = require('../Utils/path');
const ModuleManager = require('./ModuleManager');
const Repository = require('../Entities/Repository');
const Directory = require('../Entities/Directory');
const logger = require('../Utils/Logger');
const Module = require('../Module/Module');

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
        this.locked = false;

        if (options.get('restrictionsForStore')) {
            this.whiteList = require(options.get('restrictionsForStore'));
            this.whiteList['https://git.sbis.ru/saby/wasaby-cli'] = [];

            this.filterReps = new Set();

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

        if (fs.pathExistsSync(this.pathLockFile)) {
            this.locked = true;
        }
    }

    get lockInfo() {
        if (this.locked) {
            return require(this.pathLockFile);
        }

        return undefined;
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

        await this.loadRepositories(repositories);
    }

    async loadRepositories(repositories) {
        await pMap(repositories.values(), async(repository) => {
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

                this.modules.set(module.id, module);
            }

            this.repositories.set(repository.name, repository);
        }, {
            concurrency: this.concurrencyLoadRepos
        });
    }

    async save() {
        const serializeCache = JSON.stringify(this.serialize(), null, 3);

        await Promise.all([
            fs.outputFile(this.cachePath, serializeCache),
            logger.writeFile('store.json', serializeCache)
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

    async lock(whoLocked) {
        const lockData = {
            whoLocked,
            cwd: process.cwd(),
        };
        const signals = ['SIGINT', 'SIGTERM', 'SIGHUP', 'SIGTSTP'];

        for (const signal of signals) {
            process.on(signal, () => {
                this.unlock();

                process.exit(2);
            });
        }

        process.on('uncaughtException', () => {
            this.unlock();
        });

        process.on('exit', () => {
            this.unlock();
        });

        await fs.outputFile(this.pathLockFile, JSON.stringify(lockData, null, 3));

        this.locked = true;
    }

    unlock() {
        if (this.locked) {
            fs.removeSync(this.pathLockFile);

            this.locked = false;
        }
    }
}

module.exports = Store;