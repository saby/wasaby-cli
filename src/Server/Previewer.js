const BusinessLogic = require('./BusinessLogic');
const pathUtils = require('../Utils/path');
const logger = require('../Utils/Logger');

const BL_HANDLERS_DIR = 'previewer';
const DEFAULT_IMG = pathUtils.join(__dirname, 'previewer.webp');
let resourcesRoot;

class Previewer {
    static init(server, resourcesPath) {
        resourcesRoot = resourcesPath;

        server.get(/^\/previewer\//, (request, response) => {
            Previewer.process(request, response);
        });
    }

    static async process(req, res) {
        try {
            if (!req.headers.referer) {
                throw new Error(`Метод ${req.query.method} вызван не со страницы c демо примером`);
            }

            if (req.query.method) {
                logger.debug(`Обрабатываю запрос на previewer ${req.url} метода ${req.query.method} со страницы ${req.headers.referer}.`);

                const params = JSON.parse(
                    Buffer.from(req.query.args || req.query.params, 'base64').toString('utf-8')
                );
                const result = await BusinessLogic.executeMethod(
                    req.query.method,
                    params,
                    BL_HANDLERS_DIR,
                    req.headers.referer
                );

                res.sendFile(result);

                return;
            }

            if (req.url.includes('/cdn/')) {
                const [, resPath] = req.url.split('/cdn/');

                res.sendFile(pathUtils.join(resourcesRoot, 'cdn', resPath));

                return;
            }

            const params = req.url.replace('/previewer/', '').split('/');
            const result = await BusinessLogic.executeMethod(
                'Get',
                params,
                BL_HANDLERS_DIR,
                req.headers.referer
            );

            res.sendFile(result);
        } catch (error) {
            if (error.message.startsWith('Не был найден обработчик БЛ метода')) {
                res.sendFile(DEFAULT_IMG);

                return;
            }

            logger.error(error);

            res.status(500).send(BusinessLogic.createError(error));
        }
    }
}

module.exports = Previewer;