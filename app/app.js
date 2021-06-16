/* global requirejs */
/* eslint-disable no-console */
const isolated = require('saby-units/lib/isolated.js');
const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const serveStatic = require('serve-static');
const getPort = require('./net/getPort');
const path = require('path');
const fs = require('fs-extra');

const global = (function() {
   // eslint-disable-next-line no-eval
   return this || (0, eval)('this');
})();
const resourceRoot = '/';

/**
 * Запускает сервер приложения
 * @param {String} resources Путь до ресурсов
 * @param {Number} port Порт на котором будет запущен сервер
 * @param {Boolean} isDebug Запустить стенд в дебег режиме.
 * @param {Object} config Конфиг приложения
 */

async function run(resources, port, isDebug, config) {
   // Если иконка не задана в вёрстке, Chrome делает запрос за favicon.ico в корень сайта.
   // Кладём в корень пустой файл, чтобы не получать 404.
   // Когда все демки будут строиться через один роутинг, добавим иконку в вёрстку корневого шаблона.
   await fs.outputFile(path.join(resources, 'favicon.ico'), '');

   const app = express();
   const availablePort = await getPort(port || 1024);
   const rootModule = config.rootModule || '';
   const reactApp = !!config.reactApp;
   const workDir = process.cwd();
   process.chdir(resources);

   app.use(bodyParser.json());
   app.use(cookieParser());
   app.use('/', serveStatic('./'));
   app.listen(availablePort);

   const contents = require(path.join(resources, 'contents.json'));

   if (!isDebug) {
      global.contents = contents;
   }

   let requirejs = isolated.prepareTestEnvironment(
       '',
       undefined,
       false,
       undefined,
       false,
       !isDebug
   );

   global.require = requirejs;
   console.log('start init');

   const ready = new Promise((resolve, reject) => {
      requirejs(['Env/Env', 'Application/Initializer', 'Application/State',
                 'Core/core-init', 'UI/State', 'Application/Env'],
      function(Env, AppInit, AppState, CoreInit, UIState, AppEnv) {
         Env.constants.resourceRoot = resourceRoot;
         Env.constants.modules = contents.modules;

         if (!AppInit.isInit()) {
            const config = { resourceRoot, reactApp };
            // eslint-disable-next-line new-cap
            AppInit.default(config, new AppEnv.EnvNodeJS(config), new AppState.StateReceiver(UIState.Serializer));
         }

         console.log(`server started http://localhost:${availablePort}/${rootModule}`);
         resolve();
      }, function(err) {
         console.error(err);
         console.error('core init failed');
         reject(err);
      });
   });

   if (config && config.expressRoute) {
      Object.keys(config.expressRoute).forEach((route) => {
         let module = require(path.join(path.relative(__dirname, workDir), config.expressRoute[route]));
         app.use(route, module);
      });
   }

   /* server side render */
   /** Костлище решается в задаче https://online.sbis.ru/opendoc.html?guid=c3b9523f-1ea2-4dc8-aa03-27dd82e77a2d */
   app.get('/ParametersWebAPI/Scope.js', (req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/javascript' });
      res.end("define('ParametersWebAPI/Scope', [], function(){})\n");
   });

   app.get('/*', (req, res) => {
      ready.then(() => {
         serverSideRender(req, res, { isDebug, reactApp });
      });
   });
}

function serverSideRender(req, res, config) {
   presetCookies(req, res, config);

   // нужно заполнять process.domain, т.к. в Env/Env:detection есть завязки на него, напр. при определении IE
   if (!process.domain) {
      process.domain = {
         enter: () => undefined,
         exit: () => undefined
      };
   }
   process.domain.req = req;
   process.domain.res = res;

   const AppInit = requirejs('Application/Initializer');
   const AppState = requirejs('Application/State');
   const UIState = requirejs('UI/State');
   AppInit.startRequest(undefined, new AppState.StateReceiver(UIState.Serializer), () => req, () => res);

   const sabyRouter = requirejs('Router/ServerRouting');

   const options = {
      lite: true,
      wsRoot: '/WS.Core/',
      resourceRoot,
      appRoot: '/',
      reactApp: config.reactApp,
      _options: {
         preInitScript: `window.wsConfig.debug = ${config.isDebug};window.wsConfig.userConfigSupport = false;`
      }
   }
   const onSuccessHandler = function (html) {
      res.writeHead(200, {'Content-Type': 'text/html'});
      res.end(html);
   }
   const onNotFoundHandler = function(err) {
      res.status(404).end(JSON.stringify(err, null, 2));
   }

   sabyRouter.getPageSource(options, req, onSuccessHandler, onNotFoundHandler)
      .catch((e) => {
         res.status(500).end(JSON.stringify(e, null, 2));
      });

}

function presetCookies(req, res, config) {
   if (config.isDebug) {
      setCookie(req, res, 's3debug', true);
   }
   if (config.reactApp) {
      setCookie(req, res, 'reactFeatures', 'Control');
   } else {
      deleteCookie(req, res, 'reactFeatures');
   }
}

function setCookie(req, res, name, value) {
   if (req.cookies[name] === undefined) {
      res.cookie(name, value, { maxAge: 900000 });
      console.log(`cookie ${name} created successfully`);
   }
}

function deleteCookie(req, res, name) {
   if (req.cookies[name] !== undefined) {
      res.cookie(name, '', {maxAge: 0});
      console.log(`cookie ${name} deleted successfully`);
   }
}

module.exports = {
   run: run
};
