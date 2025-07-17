const https = require('node:https');

const REQUIRE_FIELD = [
    'GitUrl',
    'GitPath',
    'GitBranch',
    'Name',
    'Id'
];

/**
 * Класс для взаимодействия с сервисом Module Manager
 * @author Кудрявцев И.С.
 */
class ModuleManager {
    /**
     * Функция возвращает список зависимостей для модулей.
     * @param version {String} RC версия для которой нужно построить дерево.
     * @param modules {String[]} Список ID модулей, для которых надо вернуть дерево зависимости.
     * @returns {Promise<Map<String, Object>>}
     */
    static async getDepsList(version, modules) {
        const result = new Map();
        const nameMap = {};
        const data = JSON.parse(await ModuleManager.BlDepsList(version, modules));

        data.result.s.forEach((field, index) => {
           if (REQUIRE_FIELD.includes(field.n)) {
               nameMap[index] = field.n;
           }
        });

        for (const value of data.result.d) {
            const module = {};

            for (const [index, name] of Object.entries(nameMap)) {
                module[name] = value[index];
            }

            module.GitBranch = `rc-${module.GitBranch}`;

            result.set(module.Id, module);
        }

        return result;
    }

    /**
     * Функция возвращает список модулей, которые зависят от переданных модулей.
     * @param version RC версия для которой нужно построить дерево.
     * @param modules Список модулей от которых зависят возвращаемые модули.
     * @param repositories В каких репозиториях искать зависимые модули.
     * @returns {Promise<Object[]>}
     */
    static async getDependedModules(version, modules, repositories) {
        const data = JSON.parse(await ModuleManager.BLDependedModules(version, modules, repositories));

        return data.result || [];
    }

    /**
     * Делаем запрос в облако за методом Metadata.DependenciesList в сервис /services-info/
     * @param version {String} RC версия.
     * @param modules {String[]} Список ID модулей.
     * @returns {Promise<Object>}
     */
    static BlDepsList(version, modules) {
        const content = Buffer.from(JSON.stringify({
            'jsonrpc': '2.0',
            'protocol': 6,
            'method': 'Metadata.DependenciesList',
            'params': {
                "Фильтр": {
                    "d": [
                        modules,
                        version
                    ],
                    "s": [
                        {
                            "t": {
                                "n": "Массив",
                                "t": "Строка"
                            },
                            "n": "Modules"
                        },
                        {
                            "t": "Строка",
                            "n": "Version"
                        }
                    ],
                    "_type": "record",
                    "f": 0
                },
                "Сортировка": null,
                "Навигация": null,
                "ДопПоля": []
            },
            'id': 1
        }));
        const body = {
            host: 'cloud.sbis.ru',
            hostname: 'cloud.sbis.ru',
            port: 443,
            method: 'POST',
            path: '/services-info/service/',
            headers: {
                cookie: '',
                host: 'cloud.sbis.ru',
                origin: `https://cloud.sbis.ru`,
                referer: `https://cloud.sbis.ru/services-info/service/`,
                'x-requested-with': 'XMLHttpRequest',
                'content-type': 'application/json; charset=UTF-8',
                'content-length': content.length,
                'x-calledmethod': 'Metadata.DependenciesList',
                'x-originalmethodname': 'TWV0YWRhdGEuRGVwZW5kZW5jaWVzTGlzdA==',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
            },
            content: content
        };

        return ModuleManager.sendRequest(body);
    }

    /**
     * Делаем запрос в облако за методом Metadata.GetDependedModulesV2 в сервис /services-info/
     * @param version {String} RC версия.
     * @param modules {String[]} Список ID модулей.
     * @param repositories {String[]} Список URL репозитории.
     * @returns {Promise<Object>}
     */
    static BLDependedModules(version, modules, repositories) {
        const content = Buffer.from(JSON.stringify({
            'jsonrpc': '2.0',
            'protocol': 7,
            'method': 'Metadata.GetDependedModulesV2',
            'params': {
                "Params": {
                    "d": [
                        modules,
                        version,
                        repositories.length === 0 ? undefined : repositories,
                       'ui'
                    ],
                    "s": [
                        {
                            "t": {
                                "n": "Массив",
                                "t": "UUID"
                            },
                            "n": "Modules"
                        },
                        {
                            "t": "Строка",
                            "n": "Version"
                        },
                        {
                            "t": {
                                "n": "Массив",
                                "t": "Строка"
                            },
                            "n": "Repos"
                        },
                        {
                            "t": "Строка",
                            "n": "ModuleType"
                        }
                    ],
                    "_type": "record",
                    "f": 0
                },
            },
            'id': 1
        }));
        const body = {
            host: 'cloud.sbis.ru',
            hostname: 'cloud.sbis.ru',
            port: 443,
            method: 'POST',
            path: '/services-info/service/',
            headers: {
                cookie: '',
                host: 'cloud.sbis.ru',
                origin: `https://cloud.sbis.ru`,
                referer: `https://cloud.sbis.ru/services-info/service/`,
                'x-requested-with': 'XMLHttpRequest',
                'content-type': 'application/json; charset=UTF-8',
                'content-length': content.length,
                'x-calledmethod': 'Metadata.GetDependedModulesV2',
                'x-originalmethodname': 'TWV0YWRhdGEuR2V0RGVwZW5kZWRNb2R1bGVzVjI=',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
            },
            content: content
        };

        return ModuleManager.sendRequest(body);
    }

    /**
     * Делает запрос в облако на сервис /services-info/
     * @param bodyReq {Object} Тело запроса.
     * @returns {Promise<Object>}
     */
    static sendRequest(bodyReq = 'https') {
        return new Promise((resolve, reject) => {
            const request = https.request(bodyReq, (res) => {
                if (res.statusCode !== 200) {
                    reject(new Error(
                        `Ответ сервера ${res.statusCode}.
                   Метод: ${bodyReq.headers['x-calledmethod']}`
                    ));
                } else {
                    let result = Buffer.from('');

                    res
                        .on('data', (data) => {
                            result = Buffer.concat([result, data], result.length + data.length);
                        })
                        .on('end', () => {
                            resolve(result.toString());
                        });
                }
            });

            request.on('error', function(err) {
                reject(new Error(
                    `Не удалось отправить запрос на сервер. 
                Метод: ${bodyReq.headers['x-calledmethod']} 
                Error: ${err}`
                ));
            });

            request.end(bodyReq.content);
        });
    }
}

module.exports = ModuleManager;