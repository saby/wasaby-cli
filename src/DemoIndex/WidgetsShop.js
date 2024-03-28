const fs = require('fs-extra');
const pMap = require('p-map');
const glob = require('glob');
const pathUtils = require('../Utils/path');

const META_PREFIX = /-meta$/;

class WidgetsShop {
    constructor(cfg) {
        this.options = cfg.options;
        this.root = this.options.get('resources');
        this.metaModules = this._getMetaModulesList();
        this.path = pathUtils.join(
            this.root,
            'FrameDemoStand',
            'WidgetsShop.json'
        );
    }

    async create() {
        try {
            console.log('Генерация списка виджетов для магазина в конструкторе');

            const list = [];

            await pMap(this.metaModules, ([moduleName, modulePath]) => {
                const files = glob.sync(pathUtils.join(modulePath, '**/*Type.meta.ts'));
                const dirName = `/${moduleName}/`;

                for (const file of files) {
                    const widgetName = pathUtils.join(
                        moduleName.replace(META_PREFIX, ''),
                        file.split(dirName)[1].replace('Type.meta.ts', '')
                    );

                    list.push(widgetName);
                }
            });

            await fs.outputFile(this.path, JSON.stringify(list, null, 3));

            console.log('Список виджетов успешно сгенерирован');
        } catch (e) {
            e.message = `Генерация списка виджетов завершена с ошибкой: ${e.message}`;

            throw e;
        }
    }

    _getMetaModulesList() {
        const result = new Map();
        const contentsPath = pathUtils.join(this.options.get('resources'), 'contents.json');
        const modules = fs.existsSync(contentsPath) ? fs.readJSONSync(contentsPath).modules : {};

        for (const moduleName of Object.keys(modules)) {
            if (moduleName === 'ModuleEditor-meta') {
                continue;
            }

            if (moduleName.endsWith('-meta')) {
                result.set(moduleName, pathUtils.join(this.options.get('resources'), moduleName));
            }
        }

        return result;
    }
 }

 module.exports = WidgetsShop;