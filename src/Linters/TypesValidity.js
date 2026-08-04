const pMap = require('p-map');
const fs = require('fs-extra');
const logger = require('../Utils/Logger');

/**
 * Конфигурация для проверки .types файлов.
 * @class TypesValidity
 */
class TypesValidity {
   /**
    * Конструктор конфигурации.
    */
   constructor() {
      this.name = 'TypesValidity';
   }

   /**
    * Запускает линтер по указанным файлам.
    * @param files {String[]} Список файлов, по которы нужно прогнать линтер.
    * @returns {Promise<void>}
    */
   async start(files) {
      const typesFiles = files.filter(file => file.endsWith('.types'));
      const typesContent = typesFiles.map((file) => {
         return fs.readFile(file, 'utf-8');
      });
      return pMap(typesContent, (file, index) => {
         try {
            JSON.parse(file);
         } catch (e) {
            // пре-коммит хук не выводит ошибки, т.к. считает, что они уже в консоли.
            // Поэтому ловим ошибки, выводим, а затем кидаем снова, чтобы был корректный код выхода.
            logger.error(`Файл ${typesFiles[index]} содержит невалидный JSON.`);
            throw e;
         }
      }, {
         concurrency: 1,
         stopOnError: false
      });
   }
}

module.exports = TypesValidity;
