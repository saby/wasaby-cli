const pathUtils = require('../Utils/path');
const fs = require('fs-extra');
const logger = require('../Utils/Logger');

const featureRes = JSON.stringify({
   id: null,
   jsonrpc: '2.0',
   result: {
      i: 1800,
      f: {
         s: 0
      },
      s: '0000564400000002',
      r: {
         s: 0
      }
   }
});
let staticDir;

class BusinessLogic {
   async init(server, staticDirectory) {
      staticDir = staticDirectory;

      global.sbis = {
         BLCoreObject,
         EndPoint
      };

      server.post('*/service/', (req, res) => {
         this.process(req, res);
      });

      server.get('/previewer/*', (request, response) => {
         try {
            response.sendFile(pathUtils.join(__dirname, 'previewer.webp'));
         } catch (error) {
            response.status(500).send(this.createError(error));
         }
      });

      server.get('*/service/', (req, res) => {
         this.processGet(req, res);
      });

      server.get('/feature/*', (request, response) => {
         // TODO Не понятно как вести себя с feature. Поэтому притворяться что это уточняющий запрос и выключим все фичи.
         //  Надо будет подумать, как должны вести себя механизму фич на демо примерах.
         try {
            response.send(featureRes);
         } catch (error) {
            response.status(500).send(this.createError(error));
         }
      });
   }

   createError(error) {
      return JSON.stringify({
         error: {
            message: error.message
         }
      });
   }

   convertResponseForSbis(jsonResult) {
      return {
         id: 1,
         jsonrpc: '2.0',
         protocol: 6,
         result: jsonResult
      };
   }

   getDemoInfo(pageUrl) {
      const partsPath = pageUrl
         .replaceAll('%2F', '/')
         .split('/app/')[1]
         .split('/');

      return {
         module: pathUtils.join(staticDir, partsPath[0]),
         page: pathUtils.dirname(pathUtils.join(staticDir, partsPath.join('/')))
      };
   }

   detectedHandlerPath(methodName, serviceUrl, pageUrl) {
      const demoInfo = this.getDemoInfo(pageUrl);
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

   async executeMethod(name, params, urlService, pageUrl) {
      const handlerPath = this.detectedHandlerPath(name, urlService, pageUrl);

      if (handlerPath.endsWith('.json')) {
         return require(handlerPath);
      }

      return await require(handlerPath).execute(params);
   }

   async processGet(req, res) {
      try {
         if (!req.headers.referer) {
            throw new Error(`Метод ${req.query.method} вызван не со страницы c демо примером`);
         }

         logger.debug(`Обрабатываю БЛ запрос на сервис ${req.url} метода ${req.body.method} со страницы ${req.headers.referer}.`);

         const params = JSON.parse(Buffer.from(req.query.args || req.query.params, 'base64').toString('utf-8'));
         const result = await this.executeMethod(req.query.method, params, req.url, req.headers.referer);

         res.send(this.convertResponseForSbis(result));
      } catch (error) {
         logger.error(error);

         res.status(500).send(this.createError(error));
      }
   }

   async process(req, res) {
      try {
         logger.debug(`Обрабатываю БЛ запрос на сервис ${req.url} метода ${req.body.method} со страницы ${req.headers.referer}.`);

         const result = await this.executeMethod(req.body.method, req.body.params, req.url, req.headers.referer);

         res.send(this.convertResponseForSbis(result));
      } catch (error) {
         logger.error(error);

         res.status(500).send(this.createError(error));
      }
   }
}

class BLCoreObject extends BusinessLogic {
   constructor(name, endpoint) {
      super();

      this.nameObj = name;
      this.endpoint = endpoint;
   }

   async Invoke(method, params) {
      try {
         const fullName = `${this.nameObj}.${method}`;

         logger.debug(`Обрабатываю БЛ запрос на сервис ${this.endpoint.url} метода ${fullName} с серверного рендеринга страницы ${process.domain.req.url}.`);

         return await this.executeMethod(
            fullName,
            params,
            this.endpoint.url,
            process.domain.req.url
         );
      } catch (error) {
         throw this.createError(error);
      }
   }
}

class EndPoint {
   constructor(url) {
      this.url = url;
      this.headers = {};
      this.protocol = 6;
   }

   SetHeader(name, value) {
      this.headers[name] = value;
   }

   SetProtocol(version) {
      this.protocol = version;
   }
}

module.exports = BusinessLogic;
