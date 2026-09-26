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
async function readXmlFile(filePath) {
   try {
      const xmlString = await fs.readFile(filePath, 'utf8');

      return xml2js.parseStringPromise(xmlString)
   } catch (error) {
      logger.error(`Ошибка при чтении xml файла ${filePath}: ${error}`, 'readXmlFile');

      throw error;
   }
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
