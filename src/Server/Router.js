const logger = require('../Utils/Logger');

class Router {
   constructor(cfg) {
      this.isDebug = cfg.isDebug;

      this.appInit = cfg.appInit;
      this.appState = cfg.appState;
      this.uiState = cfg.uiState;
      this.serverRouting = cfg.serverRouting;
      this.router = requirejs('Router/router');

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
         resourceRoot: cfg.resourceRoot,
         metaRoot: cfg.resourceRoot,
         appRoot: '/',
         _options: {
            preInitScript: `window.wsConfig.debug = ${this.isDebug};window.wsConfig.userConfigSupport = false;`
         }
      };

      // нужно заполнять process.domain, т.к. в Env/Env:detection есть завязки на него, напр. при определении IE
      if (!process.domain) {
         process.domain = {
            enter: () => undefined,
            exit: () => undefined
         };
      }
   }

   render(req, res) {
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
         res.writeHead(200, { 'Content-Type': 'text/html' });
         res.end(html);
      };
      const onNotFoundHandler = (err) => {
         logger.error(`Error process request ${req.url}. Error: ${err}`);
         res.status(404).end(err.toString());
      };

      this.serverRouting.getPageSource(
         { ...this.renderOptions, renderStartTime, Router: this.router.getRootRouter() },
         req,
         onSuccessHandler,
         onNotFoundHandler,
         {
            routePrefix: this.routePrefix
         }
      ).catch((err) => {
         logger.error(`Error process request ${req.url}. Error: ${err}`);
         res.status(500).end(err.toString());
      });
   }

   presetCookies(req, res) {
      if (this.isDebug) {
         this.setCookie(req, res, 's3debug', true);
      }

      this.setCookie(req, res, 'IsWasabyCLI', true);
   }

   setCookie(req, res, name, value) {
      if (req.cookies[name] === undefined) {
         res.cookie(name, value, {
            maxAge: 900000
         });

         logger.debug(`Cookie ${name} successfully created.`);
      }
   }
}

module.exports = Router;
