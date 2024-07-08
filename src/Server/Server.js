const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const net = require('node:net');
const fs = require('fs-extra');

const pathUtils = require('../Utils/path');
const Render = require('./Render');
const Static = require('./Static');
const BusinessLogic = require('./BusinessLogic');
const logger = require('../Utils/Logger');

const MAX_ATTEMPT = 666;

const DEFAULT_PORT = 1024;

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

const randomPort = () => 40000 + Math.ceil(Math.random() * 10000);

class Server {
   constructor(options, rootUrl) {
      this.options = options;
      this.protocol = options.get('https') ? 'https' : 'http';
      this.userRouters = options.get('expressRoute') || new Map();
      this.rootUrl = rootUrl;

      process.chdir(this.options.get('resources'));

      this.static = new Static(options.get('resources'), options.get('browserCache'));

      this.render = new Render({
         isDebug: !options.get('release'),
         staticDir: options.get('resources'),
         routePrefix: options.get('routePrefix')
      });
   }

   async detectPort() {
      this.port = await Server.detectAvailablePort(this.options.get('port') || DEFAULT_PORT);
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

   createServer() {
      this.app = express();

      // Создаём обработчик для создания объекта body, если пришёл запрос в json формате, например POST
      this.app.use(bodyParser.json());

      // Создаём обработчик для трансформации cookie в объект. Сам express рекомендует https://expressjs.com/ru/4x/api.html#req.cookies
      this.app.use(cookieParser());

      // Делаем редирект, если постучались на корень сайта.
      if (this.rootUrl) {
         this.app.get('/', (req, res) => {
            res.redirect(this.rootUrl);
         });
      }

      for (const [urlPath, routerPath] of this.userRouters.entries()) {
         this.app.use(urlPath, require(routerPath));
      }
   }

   startListen() {
      this.app = this.app.listen(this.port);

      logger.info(`Server started. Root ${this.domain}`);
   }

   async start() {
      this.createServer();

      await Promise.all([
         this.detectPort(),
         this.createFavicon()
      ]);

      await BusinessLogic.init(this.app, this.options.get('resources'), this.options.get('defaultBLRoot'));

      await this.static.init(this.app, this.domain);

      await this.render.init(this.app);

      await this.createHttpsServer();

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

         this.createServer();
         await this.render.init(this.app);

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
}

module.exports = Server;
