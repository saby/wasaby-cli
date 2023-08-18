const logger = require('../../Utils/Logger');
const BusinessLogic = require('../BusinessLogic');

class BLCoreObject {
   constructor(name, endpoint) {
      this.nameObj = name;
      this.endpoint = endpoint;
   }

   Invoke(method, params) {
      try {
         const fullName = `${this.nameObj}.${method}`;

         logger.debug(`Обрабатываю БЛ запрос на сервис ${this.endpoint.url} метода ${fullName} с серверного рендеринга страницы ${process.domain.req.url}.`);

         return BusinessLogic.executeMethod(
            fullName,
            params,
            this.endpoint.url,
            process.domain.req.url
         );
      } catch (error) {
         throw BusinessLogic.createError(error);
      }
   }
}

module.exports = BLCoreObject;
