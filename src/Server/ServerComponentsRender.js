const pathUtils = require('../Utils/path');
const logger = require('../Utils/Logger');
const Queue = require('../Utils/Queue');

class Render {
   constructor(cfg) {
      this.queue = new Queue();
      this.isDebug = cfg.isDebug;
      this.staticDir = cfg.staticDir;

      // нужно заполнять process.domain, т.к. в Env/Env:detection есть завязки на него, напр. при определении IE
      if (!process.domain) {
         process.domain = {
            enter: () => undefined,
            exit: () => undefined,
            emit: (type, reason) => {
               if (type === 'error') {
                  logger.error(reason);
               }
            }
         };
      }
   }

   async init(server) {
      await this.prepareEnvironment();

      server.get(/.*/, (req, res) => {
         logger.debug(`Push request in queue. Page: ${req.url}`);

         this.queue.push(() => {
            this.render(req, res);
         });
      });
   };

   async prepareEnvironment() {
      this.initGlobalVariable();
      await this.initRouter();
   }

   initGlobalVariable() {
      globalThis.contents = require(pathUtils.join(this.staticDir, 'contents.json'));

      require(pathUtils.join(this.staticDir, 'RequireJsLoader/third-party/ServerRequire.js'));

      globalThis.wsConfig = {
         resourceRoot: '/',
         metaRoot: '/',
      };

      globalThis.initRequire(this.staticDir, '/', pathUtils.join(this.staticDir, 'cdn'));
   }

   initRouter() {
      return new Promise((resolve, reject) => {
         requirejs([
            'UICore/rsc'
         ], (
            serverRender
         ) => {
            this.serverRender = serverRender;

            resolve();
         }, (err) => {
            logger.error(`Error loading "Router/*" modules. Error: ${err}`);
            reject(err);
         });
      });
   }

   render(req, res) {
      logger.debug(`StartRenderPage: ${req.url}`);

      this.presetCookies(req, res);

      process.domain.req = req;
      process.domain.res = res;

      this.serverRender.render(req, res)
         .then((html) => {
            logger.debug(`FinishRenderPage: ${req.url}`);

            if (!res.writableEnded) {
               res.writeHead(200, { 'Content-Type': 'text/html' });
               res.end(html);
            }

            this.queue.next();
         }, (err) => {
            logger.error(`Error process request ${req.url}. Error: ${err}`);

            res.status(404).end(err.toString());

            this.queue.next();
         });
   }

   presetCookies(req, res) {
      if (this.isDebug) {
         Render.setCookie(req, res, 's3debug', true);
      }

      Render.setCookie(req, res, 'IsWasabyCLI', true);
   }

   static setCookie(req, res, name, value) {
      if (req.cookies[name] === undefined) {
         res.cookie(name, value, {
            maxAge: 900000
         });

         logger.debug(`Cookie ${name} successfully created.`);
      }
   }
}


module.exports = Render;
