const express = require('express');
const https = require('node:https');
const cookieParser = require('cookie-parser');
const net = require('node:net');
const fs = require('fs-extra');

const pathUtils = require('../Utils/path');
const MainRender = require('./Render');
const ServerComponentsRender = require('./ServerComponentsRender');
const Static = require('./Static');
const BusinessLogic = require('./BusinessLogic');
const Previewer = require('./Previewer');
const logger = require('../Utils/Logger');

const MAX_ATTEMPT = 666;
const DEFAULT_PORT = 1024;
const INFO_FILE_NAME = 'standInfo.json';


const busyPorts = new Set();

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

const defaultServerOpts = {
   enableRender: true,
   enableBL: true,
   enablePreviewer: true,
   enableStatics: true,
};

const randomPort = () => 40000 + Math.ceil(Math.random() * 10000);

class Server {
   constructor(options, serverOptions = {}) {
      const Render = options.get('serverComponents') ? ServerComponentsRender : MainRender;

      this.serverOpts = {...defaultServerOpts, ...serverOptions};
      this.options = options;
      this.protocol = options.get('https') ? 'https' : 'http';
      this.userRouters = options.get('expressRoute') || new Map();

      if (this.serverOpts.enableStatics) {
         this.static = new Static(options.get('resources'), options.get('browserCache'));
      }

      if (this.serverOpts.enableRender) {
         this.render = new Render({
            isDebug: !options.get('release'),
            staticDir: options.get('resources'),
            routePrefix: options.get('routePrefix')
         });
      }
   }

   async detectPort() {
      this.port = await Server.detectAvailablePort(this.options.get('port') || DEFAULT_PORT);
      this.keepAliveTimeout = this.options.get('keepAliveTimeout');
      this.domain = `${this.protocol}://localhost:${this.port}`;
   }

   async createFavicon() {
      // Если иконка не задана в вёрстке, Chrome делает запрос за favicon.ico в корень сайта.
      // Кладём в корень пустой файл, чтобы не получать 404.
      // Когда все демки будут строиться через один роутинг, добавим иконку в вёрстку корневого шаблона.
      await fs.outputFile(pathUtils.join(this.options.get('resources'), 'favicon.ico'), '');
   }

   async createHttpsServer() {
      if (this.protocol !== 'https') {
         return;
      }

      const [key, cert] = await Promise.all([
         fs.readFile(pathUtils.join(__dirname, './HTTPSCertificate/cert.key')),
         fs.readFile(pathUtils.join(__dirname, './HTTPSCertificate/cert.crt'))
      ]);

      this.app = https.createServer({
         key,
         cert
      }, this.app);
   }

   createServer() {
      this.app = express();

      // Создаём обработчик для создания объекта body, если пришёл запрос в json формате, например POST
      this.app.use(express.json({ limit: '50mb' }));
      this.app.use(express.text());

      // Создаём обработчик для трансформации cookie в объект. Сам express рекомендует https://expressjs.com/ru/4x/api.html#req.cookies
      this.app.use(cookieParser());

      // Делаем редирект, если постучались на корень сайта.
      if (this.serverOpts.rootUrl) {
         this.app.get('/', (req, res) => {
            res.redirect(this.serverOpts.rootUrl);
         });
      }

      for (const [urlPath, routerPath] of this.userRouters.entries()) {
         this.app.use(urlPath, require(routerPath));
      }
   }

   startListen() {
      this.app = this.app.listen(this.port);
      if (this.keepAliveTimeout) {
         this.app.keepAliveTimeout = this.keepAliveTimeout;
         // Должен быть больше keepAlive, требование nodejs https://github.com/nodejs/node/issues/27363
         this.app.headersTimeout = this.keepAliveTimeout + 5000;
      }

      logger.info(`Server started. Root ${this.domain}`);
   }

   async startHandlers() {

      // На все служеюные запросы браузера отвечаем 404. Это самое правильное поведение, мы не обязаны им ничего предоставлять.
      this.app.get(/^\/.well-known\/.*/, (req, res) => {
         res.status(404).send('Not Found');
      });

      if (this.serverOpts.enablePreviewer) {
         await Previewer.init(this.app, this.options.get('resources'));
      }

      if (this.serverOpts.enableBL) {
         await BusinessLogic.init(this.app, this.options.get('resources'), this.options.get('defaultBLRoot'));
      }

      if (this.serverOpts.enableStatics) {
         await this.static.init(this.app, this.domain, this.serverOpts.staticsHandler);
      }

      // Должен быть всегда последним, потому что он навешивает обрабочтик на для всех url.
      // Express проверят патерны в порядке их обхявления, поэтому до этого он должен доходить только если другие не сработали
      if (this.serverOpts.enableRender) {
         await this.render.init(this.app);
      }
   }

   async start() {
      this.createServer();

      await Promise.all([
         this.detectPort(),
         this.createFavicon(),
      ]);

      await this.startHandlers();

      await this.createHttpsServer();

      this.startListen();

      await this._writeInfo();
   }

   stop() {
      return new Promise((resolve) => {
         this.app.close(() => {
            resolve();
         });
      });
   }

   async clearCache() {
      await this.render.clearCache();
   }

   async restart() {
      try {
         await this.stop();

         this.createServer();

         await this.startHandlers();

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

         // eslint-disable-next-line no-await-in-loop
         if (!busyPorts.has(port) && await checkPort(port)) {
            busyPorts.add(port);

            return port;
         }
      }

      return DEFAULT_PORT;
   }

   async _writeInfo() {
      const standInfo = JSON.stringify({
         port: this.port,
         domain: this.domain,
         staticDir: this.options.get('resources')
      }, null, 3);

      await Promise.all([
         fs.outputFile(pathUtils.join(this.options.get('resources'), INFO_FILE_NAME), standInfo),
         logger.writeFile(INFO_FILE_NAME, standInfo)
      ]);
   }
}

module.exports = Server;
