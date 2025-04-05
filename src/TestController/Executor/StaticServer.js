'use strict';

// TODO: объединить с существующим сервером

const path = require('path');
const url = require('url');
const fs = require('fs');
const connect = require('connect');
const http = require('http');
const serveStatic = require('serve-static');
const logger = console;
const LOGGER_PREFIX = '[jest]';
const EMPTY_PAGE = '<!DOCTYPE html>';

const randomPort = () => {
    return 40_000 + Math.ceil(Math.random() * 10_000);
};

const getServer = (port, app, rootDir) => {
    return new Promise((resolve) => {
        const server = http.createServer(app);

        server.on('error', async () => {
            resolve(await getServer(randomPort(), app, rootDir));
        });

        server.listen(port, () => {
            logger.log(`${LOGGER_PREFIX} Starting static server at port ${port} with rootDir "${rootDir}"`);
            resolve([server, port]);
        });
    });
};

function runStaticServer(rootDir) {
    return new Promise(async (resolve) => {
        const defaultHandler = serveStatic(rootDir);
        const app = connect()
            .use((request, response, next) => {
                const requestUrl = url.parse(request.url);
                let requestPath = requestUrl.pathname;

                if (requestPath.startsWith('/')) {
                    requestPath = requestPath.substr(1);
                }

                if (!requestPath) {
                    response.end(EMPTY_PAGE);
                    return;
                }

                const fileName = path.join(rootDir, requestPath);
                const fileExists = fs.existsSync(fileName);

                if (!fileExists) {
                    return defaultHandler(request, response, next);
                }

                const fileData = fs.readFileSync(fileName);
                response.end(fileData);
            });

        let [server, port] = await getServer(randomPort(), app, rootDir);

        const shutDown = () => {
            if (!server) {
                return;
            }

            logger.log(`${LOGGER_PREFIX} Stopping static server at port ${port}`);
            server.close();
            server = null;
        };

        resolve({ port, shutDown });
    });
}

module.exports = runStaticServer;
