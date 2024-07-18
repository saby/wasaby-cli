const fs = require('fs-extra');
const pathUtils = require('../Utils/path');
const logger = require('../Utils/Logger');

// Обманываем правило стана. https://wi.sbis.ru/doc/platform/developmentapl/development-tools/stan/js/#raw-bl-data
const FORMAT_NAME = 's';
const featureRes = JSON.stringify({
   id: null,
   jsonrpc: '2.0',
   result: {
      i: 1800,
      f: {
         [FORMAT_NAME]: 0
      },
      [FORMAT_NAME]: '0000564400000002',
      r: {
         [FORMAT_NAME]: 0
      }
   }
});
let staticDir;
const urlClearRegExp = /^((http|https):\/\/[\w:\.-]+\/)|^\//;

class BusinessLogic {
   static init(server, staticDirectory) {
      const EndPoint = require('./BusinessLogic/EndPoint');
      const BLCoreObject = require('./BusinessLogic/BLCoreObject');

      staticDir = staticDirectory;

      global.sbis = {
         BLCoreObject,
         EndPoint
      };

      server.post('*/service/', (req, res) => {
         BusinessLogic.process(req, res);
      });

      server.get('/previewer/*', (request, response) => {
         try {
            response.sendFile(pathUtils.join(__dirname, 'previewer.webp'));
         } catch (error) {
            response.status(500).send(BusinessLogic.createError(error));
         }
      });

      server.get('*/service/', (req, res) => {
         BusinessLogic.processGet(req, res);
      });

      server.get('/feature/*', (request, response) => {
         // TODO Не понятно как вести себя с feature.
         //  Поэтому притворимся, что это уточняющий запрос и выключим все фичи.
         //  Надо будет подумать, как должны вести себя механизм фич на демо примерах.
         try {
            response.send(featureRes);
         } catch (error) {
            response.status(500).send(BusinessLogic.createError(error));
         }
      });
   }

   static createError(error) {
      return JSON.stringify({
         error: {
            message: error.message
         }
      });
   }

   static convertResponseForSbis(jsonResult) {
      return {
         id: 1,
         jsonrpc: '2.0',
         protocol: 6,
         result: jsonResult
      };
   }

   static getDemoName(url) {
      let urlWithoutQuery = url.split('?')[0];

      if (urlWithoutQuery.includes('/app/')) {
         return urlWithoutQuery.split('/app/')[1];
      }

      if (urlWithoutQuery.includes('/FrameDemoStand/')) {
         return urlWithoutQuery.split('/FrameDemoStand/')[1];
      }

      if (urlWithoutQuery.includes('/DemoStand/')) {
         return urlWithoutQuery.split('/DemoStand/')[1];
      }

      // локальный стенд со своей точкой входа в демки
      // на СП url = /FrameRouting/Navigation/Index/_/dynamic/url
      // вызов из browser'а url = http://localohost:123/FrameRouting/Navigation/Index/_/dynamic/url
      // по '/_/' отбрасываем правую часть, т.к. это динамичная часть url, которая не связана с файлами в файловой системе
      // потом удалим всё что вначале: http://localohost:123/
      // в итоге получим строку /FrameRouting/Navigation/Index, по которой легко определить папку с моками
      urlWithoutQuery = urlWithoutQuery.split('/_/')[0];
      return urlWithoutQuery.replace(urlClearRegExp, '');
   }

   static getStandName(url) {
      if (url.includes('/DemoStand/')) {
         return 'DemoStand';
      }

      if (url.includes('/FrameDemoStand/')) {
         return 'FrameDemoStand';
      }

      return '';
   }

   static getDemoInfo(pageUrl) {
      const fixPath = pageUrl.replaceAll('%2F', '/');
      const partsPath = BusinessLogic.getDemoName(fixPath).split('/');
      const pagePath = pathUtils.dirname(pathUtils.join(staticDir, partsPath.join('/')));
      const modulePath = pathUtils.join(staticDir, partsPath[0]);

      return [
         staticDir === pagePath ? modulePath : pagePath,
         modulePath,
         pathUtils.join(staticDir, BusinessLogic.getStandName(fixPath)),
      ];
   }

   static executeMethod(name, params, serviceUrl, pageUrl) {
      const demoInfo = BusinessLogic.getDemoInfo(pageUrl);
      const servicePath = serviceUrl.slice(0, serviceUrl.indexOf('/service/'));
      const methodHandlerPath = pathUtils.join('BLHandlers', servicePath, `${name.replace('.', '/')}.js`);
      const methodResultPath = pathUtils.join('BLHandlers', servicePath, `${name.replace('.', '/')}.json`);

      for (const root of demoInfo) {
         const handlerPath = pathUtils.join(root, methodHandlerPath);

         if (fs.existsSync(handlerPath)) {
            return require(handlerPath).execute(params);
         }

         const resultPath = pathUtils.join(root, methodResultPath);

         if (fs.existsSync(resultPath)) {
            return require(resultPath);
         }
      }

      throw new Error(`Не был найден обработчик БЛ метода ${name} из сервиса ${serviceUrl} для демо примера ${pageUrl}`);
   }

   static async processGet(req, res) {
      try {
         if (!req.headers.referer) {
            throw new Error(`Метод ${req.query.method} вызван не со страницы c демо примером`);
         }

         logger.debug(`Обрабатываю БЛ запрос на сервис ${req.url} метода ${req.body.method} со страницы ${req.headers.referer}.`);

         const params = JSON.parse(
             Buffer.from(req.query.args || req.query.params, 'base64').toString('utf-8')
         );
         const result = await BusinessLogic.executeMethod(
             req.query.method,
             params,
             req.url,
             req.headers.referer
         );

         res.send(BusinessLogic.convertResponseForSbis(result));
      } catch (error) {
         logger.error(error);

         res.status(500).send(BusinessLogic.createError(error));
      }
   }

   static async process(req, res) {
      try {
         logger.debug(`Обрабатываю БЛ запрос на сервис ${req.url} метода ${req.body.method} со страницы ${req.headers.referer}.`);

         const result = await BusinessLogic.executeMethod(
             req.body.method,
             req.body.params,
             req.url,
             req.headers.referer
         );

         res.send(BusinessLogic.convertResponseForSbis(result));
      } catch (error) {
         logger.error(error);

         res.status(500).send(BusinessLogic.createError(error));
      }
   }
}

module.exports = BusinessLogic;
