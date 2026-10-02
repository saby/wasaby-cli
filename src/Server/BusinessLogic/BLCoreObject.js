const logger = require('../../Utils/Logger');

class BLCoreObject {
   constructor(name, endpoint) {
      this.nameObj = name;
      this.endpoint = endpoint;
   }

   Invoke(method, params) {
      return new Promise(async (resolve, reject) => {
         const BusinessLogic = require('../BusinessLogic');

         try {
            const fullName = `${this.nameObj}.${method}`;
            const { protocol, url } = process.domain.req;
            const host = process.domain.req.headers.host || process.domain.req.host;
            const pageUrl = `${protocol}://${host}${url}`;

            logger.debug(`Обрабатываю БЛ запрос на сервис ${this.endpoint.url} метода ${fullName} с серверного рендеринга страницы ${pageUrl}.`);

            const result = await BusinessLogic.executeMethod(
               fullName,
               params,
               this.endpoint.url,
               pageUrl
            );

            resolve(result);
         } catch (error) {
            reject(BusinessLogic.createError(error));
         }
      });
   }
}

module.exports = BLCoreObject;
