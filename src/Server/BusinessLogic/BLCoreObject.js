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

            logger.debug(`Обрабатываю БЛ запрос на сервис ${this.endpoint.url} метода ${fullName} с серверного рендеринга страницы ${process.domain.req.url}.`);

            const result = await BusinessLogic.executeMethod(
               fullName,
               params,
               this.endpoint.url,
               process.domain.req.url
            );

            resolve(result);
         } catch (error) {
            reject(BusinessLogic.createError(error));
         }
      });
   }
}

module.exports = BLCoreObject;
