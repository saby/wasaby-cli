const pathUtils = require('../Utils/path');
const isolated = require('saby-units/lib/isolated.js');
const logger = require('../Utils/Logger');
const Queue = require('../Utils/Queue');

const RESOURCE_ROOT = '/';

class Render {
   constructor(cfg) {
      this.queue = new Queue();
      this.isDebug = cfg.isDebug;
      this.staticDir = cfg.staticDir;

      /**
       * Префикс, указываемый в package.json, который будет удаляться из текущего url страницы.
       * Остаток url адреса будет использоваться для вычисления названия модуля, который строит нужную страницу.
       * Напр. есть url /MyDemo/app/MyDemo%2FSomeDemo%2FIndex
       * Если указана опция routePrefix = '/MyDemo/app', то декодируем url, из этого url удалим этот префикс,
       * и в результате будем строить контрол MyDemo/SomeDemo/Index
       */
      this.routePrefix = cfg.routePrefix;

      this.renderOptions = {
         lite: true,
         wsRoot: '/WS.Core/',
         resourceRoot: RESOURCE_ROOT,
         metaRoot: RESOURCE_ROOT,
         appRoot: '/',
         _options: {
            preInitScript: `window.wsConfig.debug = ${this.isDebug};window.wsConfig.userConfigSupport = false;`
         }
      };

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

      server.get('/*', (req, res) => {
         logger.debug(`Push request in queue. Page: ${req.url}`);

         this.queue.push(() => {
            this.render(req, res);
         });
      });
   };

   async prepareEnvironment() {
      this.initGlobalVariable();
      await this.initCore();
      await this.initConstants();
      await this.initApplication();
      await this.initRouter();
   }

   initGlobalVariable() {
      globalThis.contents = require(pathUtils.join(this.staticDir, 'contents.json'));
      globalThis.require = isolated.prepareTestEnvironment(
         '',
         undefined,
         true,
         undefined,
         false,
         !this.isDebug
      );
   }

   initConstants() {
      return new Promise((resolve, reject) => {
         requirejs(['Env/Env'], (env) => {
            env.constants.resourceRoot = RESOURCE_ROOT;
            env.constants.metaRoot = RESOURCE_ROOT;
            env.constants.modules = globalThis.contents.modules;

            resolve();
         }, (err) => {
            logger.error(`Error loading "Env/Env" module. Error: ${err}`);
            reject(err);
         });
      });
   }

   initCore() {
      return new Promise((resolve, reject) => {
         requirejs(['Core/core-init'], () => {
            resolve();
         }, (err) => {
            logger.error(`Error loading "Core/core-init" module. Error: ${err}`);
            reject(err);
         });
      });
   }

   initRouter() {
      return new Promise((resolve, reject) => {
         requirejs([
            'Router/ServerRouting',
            'Router/router'
         ], (
            serverRouting,
            router
         ) => {
            this.serverRouting = serverRouting;
            this.router = router;

            resolve();
         }, (err) => {
            logger.error(`Error loading "Router/*" modules. Error: ${err}`);
            reject(err);
         });
      });
   }

   initApplication() {
      return new Promise((resolve, reject) => {
         requirejs([
            'Application/Initializer',
            'Application/State',
            'UI/State',
            'Application/Env'
         ], (
            appInit,
            appState,
            uiState,
            appEnv
         ) => {
            this.appInit = appInit;
            this.appState = appState;
            this.uiState = uiState;

            if (!this.appInit.isInit()) {
               const config = {
                  RESOURCE_ROOT,
                  metaRoot: RESOURCE_ROOT
               };

               this.appInit.default(
                  config,
                  new appEnv.EnvNodeJS(config),
                  new this.appState.StateReceiver(uiState.Serializer)
               );
            }

            resolve();
         }, (err) => {
            logger.error(`Error loading modules for init application. Error: ${err}`);
            reject(err);
         });
      });
   }

   render(req, res) {
      logger.debug(`StartRenderPage: ${req.url}`);

      this.presetCookies(req, res);

      // время старта построения страницы
      const renderStartTime = Date.now();

      process.domain.req = req;
      process.domain.res = res;

      this.appInit.startRequest(
         undefined,
         new this.appState.StateReceiver(this.uiState.Serializer),
         () => req,
         () => res
      );

      const onSuccessHandler = (html) => {
         logger.debug(`FinishRenderPage: ${req.url}`);

         res.writeHead(200, { 'Content-Type': 'text/html' });
         res.end(html);

         this.queue.next();
      };

      const onNotFoundHandler = (err) => {
         logger.error(`Error process request ${req.url}. Error: ${err}`);

         res.status(404).end(err.toString());

         this.queue.next();
      };

      this.serverRouting.getPageSource(
         { ...this.renderOptions, renderStartTime, Router: this.router.getRootRouter() },
         req,
         onSuccessHandler,
         onNotFoundHandler,
         {
            routePrefix: this.routePrefix
         }
      ).then((result) => {
         logger.debug(result);

         this.queue.next();
      }, (err) => {
         logger.error(`Error process request ${req.url}. Error: ${err}`);

         res.status(500).end(err.toString());

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
