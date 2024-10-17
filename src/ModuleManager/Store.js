const fs = require('fs-extra');
const pMap = require('p-map');
const pathUtils = require('../Utils/path');
const ModuleManager = require('./ModuleManager');
const Repository = require('../Entities/Repository');
const ModulesMap = require('../Map/Modules');
const RepositoriesMap = require('../Map/Repositories');
const logger = require('../Utils/Logger');

// Нам нужно всягда грузить все cdn модули, потому не кто не указывает их в зависимостях.
// Для этого запросит от Module Manager информацию по одному модую из каждого cdn репозитория, но вычитаем от туда все.
const CDN_MODULES = [
    // https://git.sbis.ru/saby/wasaby-cdn.git
    '60e42987-4d2c-4455-a254-97257c2314d6',
    // https://git.sbis.ru/engine/cdn.git
    '6e2c351e-fc7c-4bed-b718-e2eb28ac3d0e',
    // https://git.sbis.ru/sbis/cdn.git
    'ed17c631-6d03-4913-8c5d-e2081c398774',
    // https://git.sbis.ru/online/cdn.git
    'fd701948-fd2c-489b-a514-e958418882f4',
];

const DEFAULT_MODULES = [
    // Typescript
    '0e6a9dbb-14e5-4382-9430-b6e73a53dc79',
    // ThemeModules
    'f515eba2-dad5-4cc3-bef8-2ff45bd2a880',
];

class Store {
    constructor(path) {
        this.path = path;
        this.cachePath = pathUtils.join(this.path, 'store.json');

        if (fs.pathExistsSync(this.cachePath)) {
            const { repositories, modules } = require(this.cachePath);
            this.repositories = new RepositoriesMap(repositories);
            this.modules = new ModulesMap(modules);
        } else {
            this.repositories = new RepositoriesMap();
            this.modules = new ModulesMap();
        }
    }

    async load(version, rootModules) {
        const modules = await ModuleManager.getDepsList(
            version,
            [...CDN_MODULES, ...DEFAULT_MODULES, ...rootModules]
        );
        const repositories = new Map();

        this.repositories = new RepositoriesMap();
        this.modules = new ModulesMap();

        for (const module of modules.values()) {
            if (!repositories.has(module.GitUrl)) {
                repositories.set(module.GitUrl, new Repository({
                    url: module.GitUrl,
                    dir: this.path,
                    requiredBranch: module.GitBranch,
                    loadHistory: false
                }));
            }
        }

        await pMap(repositories.values(), async(repository) => {
            await repository.init();

            const repModules = await repository.getModules();

            for (const module of repModules.getModules()) {
                if (modules.has(module.id) || repository.isCDN()) {
                    this.modules.add(module);
                }
            }

            this.repositories.add(repository);
        }, {
            concurrency: 5
        });

        await this.save();
    }

    async save() {
        const serializeCache = JSON.stringify(this.serialize(), null, 3);

        await Promise.all([
            fs.outputFile(this.cachePath, serializeCache),
            logger.writeFile('store.json', serializeCache)
        ]);
    }

    getModule(id) {

    }

    getDependencies(modules) {

    }

    serialize() {
        return {
            repositories: this.repositories.serialize(),
            modules: this.modules.serialize()
        };
    }
}

module.exports = Store;