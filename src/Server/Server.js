const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const serveStatic = require('serve-static');
const net = require('net');
const fs = require('fs-extra');

const pathUtils = require('../Utils/path');
const Router = require('./Router');
const logger = require('../Utils/Logger');

const isolated = require('saby-units/lib/isolated.js');

const MAX_ATTEMPT = 666;

const busyPorts = new Set();

const CORE_MODULES = [
   'Env/Env',
   'Application/Initializer',
   'Application/State',
   'Core/core-init',
   'UI/State',
   'Application/Env'
];
const DEFAULT_PORT = 1024;
const resourceRoot = '/';

/**
 * Проверяет занят ли порт
 * @param {Number} port
 * @returns {Promise<Number>}
 */
const checkPort = port => new Promise((resolve) => {
   const server = net.createServer();
   server.unref();
   server.on('error', () => {
      resolve(false);
   });
   server.listen(port, () => {
      server.close(() => {
         resolve(true);
      });
   });
});

const randomPort = () => 40000 + Math.ceil(Math.random() * 10000);


class Server {
   constructor(options) {
      this.options = options;
      this.protocol = options.get('https') ? 'https' : 'http';
      this.isDebug = !options.get('release');
      this.userRouters = options.get('expressRoute') || new Map();
      this.cacheTime = options.get('browserCache') ? 60 * 60 * 1000 : 0;

      /**
       * Префикс, указываемый в package.json, который будет удаляться из текущего url страницы.
       * Остаток url адреса будет использоваться для вычисления названия модуля, который строит нужную страницу.
       * Напр. есть url /MyDemo/app/MyDemo%2FSomeDemo%2FIndex
       * Если указана опция routePrefix = '/MyDemo/app', то декодируем url, из этого url удалим этот префикс,
       * и в результате будем строить контрол MyDemo/SomeDemo/Index
       */
      this.routePrefix = options.get('routePrefix');

      process.chdir(this.options.get('resources'));
   }

   async detectPort() {
      this.port = await Server.detectAvailablePort(this.options.get('port') || DEFAULT_PORT);
   }

   async createFavicon() {
      // Если иконка не задана в вёрстке, Chrome делает запрос за favicon.ico в корень сайта.
      // Кладём в корень пустой файл, чтобы не получать 404.
      // Когда все демки будут строиться через один роутинг, добавим иконку в вёрстку корневого шаблона.
      fs.outputFile(pathUtils.join(this.options.get('resources'), 'favicon.ico'), '');
   }

   async prepareEnvironment() {
      const global = (function() {
         // eslint-disable-next-line no-eval
         return this || (0, eval)('this');
      })();
      const contents = require(pathUtils.join(this.options.get('resources'), 'contents.json'));

      global.contents = contents;

      global.require = isolated.prepareTestEnvironment(
         '',
         undefined,
         false,
         undefined,
         false,
         !this.isDebug
      );

      return new Promise((resolve, reject) => {
         requirejs(CORE_MODULES, (env, appInit, appState, CoreInit, uiState, appEnv) => {
            env.constants.resourceRoot = resourceRoot;
            env.constants.metaRoot = resourceRoot;
            env.constants.modules = contents.modules;

            if (!appInit.isInit()) {
               const config = {
                  resourceRoot,
                  metaRoot: resourceRoot
               };

               appInit.default(config, new appEnv.EnvNodeJS(config), new appState.StateReceiver(uiState.Serializer));
            }

            this.router = new Router({
               isDebug: this.isDebug,
               routerPrefix: this.options.get('routerPrefix'),
               resourceRoot,
               appInit,
               appState,
               uiState,
               serverRouting: requirejs('Router/ServerRouting')
            });

            resolve();
         }, (err) => {
            logger.error(`Error loading modules of core. Error: ${err}`);
            reject(err);
         });
      });
   }

   async createHttpsServer() {
      const spdy = require('spdy');

      const [key, cert] = await Promise.all([
         fs.readFile(pathUtils.join(__dirname, './HTTPSCertificate/cert.key')),
         fs.readFile(pathUtils.join(__dirname, './HTTPSCertificate/cert.crt'))
      ]);

      this.app = spdy.createServer({
         key,
         cert
      }, this.app);
   }

   async createServer() {
      this.app = express();

      this.app.use(bodyParser.json());
      this.app.use(cookieParser());
      this.app.use('/', serveStatic('./', {
         immutable: true,
         maxAge: this.cacheTime,
         etag: false,
         lastModified: false
      }));

      for (const [urlPath, routerPath] of this.userRouters.entries()) {
         this.app.use(urlPath, require(routerPath));
      }

      /** Костылище решается в задаче https://online.sbis.ru/opendoc.html?guid=c3b9523f-1ea2-4dc8-aa03-27dd82e77a2d */
      this.app.get('/ParametersWebAPI/Scope.js', (req, res) => {
         res.writeHead(200, { 'Content-Type': 'text/javascript' });
         res.end("define('ParametersWebAPI/Scope', [], function(){})\n");
      });

      this.app.get('/*', (req, res) => {
         this.router.render(req, res);
      });

      if (this.protocol === 'https') {
         await this.createHttpsServer();
      }
   }

   startListen() {
      this.rootUrl = `${this.protocol}://localhost:${this.port}`;

      this.app = this.app.listen(this.port);

      logger.info(`Server started. Root ${this.rootUrl}`);
   }

   async start() {
      await Promise.all([
         this.prepareEnvironment(),
         this.createServer(),
         this.detectPort(),
         this.createFavicon()
      ]);

      this.startListen();
   }

   stop() {
      return new Promise((resolve) => {
         this.app.close(() => {
            resolve();
         });
      });
   }

   async restart() {
      try {
         await this.stop();

         await Promise.all([
            this.prepareEnvironment(),
            this.createServer()
         ]);

         this.startListen();
      } catch (err) {
         logger.error(err);
      }
   }

   static async detectAvailablePort(userPort) {
      if (userPort && !busyPorts.has(userPort) && await checkPort(userPort)) {
         busyPorts.add(userPort);

         return userPort;
      }

      for (let attempt = 0; attempt <= MAX_ATTEMPT; attempt++) {
         const port = randomPort();

         if (!busyPorts.has(port) && await checkPort(port)) {
            busyPorts.add(port);

            return port;
         }
      }
   }
}

module.exports = Server;
