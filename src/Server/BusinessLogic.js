const fs = require('fs-extra');
const pathUtils = require('../Utils/path');
const logger = require('../Utils/Logger');
const EndPoint = require('./BusinessLogic/EndPoint');
const BLCoreObject = require('./BusinessLogic/BLCoreObject');

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

class BusinessLogic {
   static init(server, staticDirectory) {
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

   static getDemoInfo(pageUrl) {
      const partsPath = pageUrl
         .replaceAll('%2F', '/')
         .split('/app/')[1]
         .split('/');

      return {
         module: pathUtils.join(staticDir, partsPath[0]),
         page: pathUtils.dirname(pathUtils.join(staticDir, partsPath.join('/')))
      };
   }

   static detectedHandlerPath(methodName, serviceUrl, pageUrl) {
      const demoInfo = BusinessLogic.getDemoInfo(pageUrl);
      const servicePath = serviceUrl.slice(0, serviceUrl.indexOf('/service/'));
      const methodHandlerPath = `${methodName.replace('.', '/')}.js`;
      const methodResultPath = `${methodName.replace('.', '/')}.json`;

      const pageHandlerPath = pathUtils.join(demoInfo.page, 'BLHandlers', servicePath, methodHandlerPath);

      if (fs.existsSync(pageHandlerPath)) {
         return pageHandlerPath;
      }

      const pageResultPath = pathUtils.join(demoInfo.page, 'BLHandlers', servicePath, methodResultPath);

      if (fs.existsSync(pageResultPath)) {
         return pageResultPath;
      }

      const moduleHandlerPath = pathUtils.join(demoInfo.module, 'BLHandlers', servicePath, methodHandlerPath);

      if (fs.existsSync(moduleHandlerPath)) {
         return moduleHandlerPath;
      }

      const moduleResultPath = pathUtils.join(demoInfo.module, 'BLHandlers', servicePath, methodResultPath);

      if (fs.existsSync(moduleResultPath)) {
         return moduleResultPath;
      }

      throw new Error(`Не был найден обработчик БЛ метода ${methodName} из сервиса ${serviceUrl} для демо примера ${pageUrl}`);
   }

   static executeMethod(name, params, urlService, pageUrl) {
      const handlerPath = BusinessLogic.detectedHandlerPath(name, urlService, pageUrl);

      if (handlerPath.endsWith('.json')) {
         return require(handlerPath);
      }

      return require(handlerPath).execute(params);
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
