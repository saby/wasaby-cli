const fs = require('fs-extra');
const xml2js = require('xml2js');

const logger = require('../../src/Utils/Logger');

/**
 * Чтение/запись в xml файл
 * @author Ганшин Я.О
 */


/**
 * Читает xml файл
 * @param {String} filePath Путь до файла
 * @returns {Promise<*>}
 */
function readXmlFile(filePath) {
   return new Promise((resolve, reject) => {
      const parser = new xml2js.Parser();
      const xmlString = fs.readFileSync(filePath, 'utf8');

      parser.parseString(xmlString, (error, result) => {
         if (error === null) {
            resolve(result);
         } else {
            logger.error(`Ошибка при чтении xml файла ${filePath}: ${error}`, 'readXmlFile');
            reject(error);
         }
      });
   });
}

/**
 * Записывает объект в xml файл
 * @param {string} filePath - Путь до файла
 * @param {Object} obj - Объект который надо записать
 */
async function writeXmlFile(filePath, obj) {
   const builder = new xml2js.Builder();
   const xml = builder.buildObject(obj);

   await fs.outputFile(filePath, xml);
}

module.exports = {
   readXmlFile: readXmlFile,
   writeXmlFile: writeXmlFile
};
