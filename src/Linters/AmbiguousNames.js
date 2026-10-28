const pMap = require('p-map').default;
const logger = require('../Utils/Logger');
const path = require('node:path');

const FRONTEND_FILE_EXTENSIONS = new Set([
   '.ts',
   '.tsx',
   '.less',
   '.css',
   '.wml',
   '.js',
   '.jsx'
]);

const RUSSIAN_SYMBOLS = /[а-яА-Я]/;
const ENGLISH_SYMBOLS = /[a-zA-Z]/;

/**
 * Конфигурация для проверки смешивания языков в названиях файлов.
 * @class AmbiguousNames
 */
class AmbiguousNames {
   /**
    * Конструктор конфигурации.
    */
   constructor() {
      this.name = 'AmbiguousNames';
   }

   /**
    * Запускает проверку по указанным файлам.
    * @param files {String[]} Список файлов, по которы нужно прогнать проверку.
    * @returns {Promise<void>}
    */
   async start(files) {
      const brokenFileNames = [];
      files.forEach((file) => {
         const parsed = path.parse(file);
         if (!FRONTEND_FILE_EXTENSIONS.has(parsed.ext)) {
            return;
         }
         const nameParts = parsed.name.split(/[ \-]/);
         nameParts.forEach((namePart) => {
            if (RUSSIAN_SYMBOLS.test(namePart) && ENGLISH_SYMBOLS.test(namePart)) {
               brokenFileNames.push([file, namePart]);
            }
         });
      });
      if (brokenFileNames.length) {
         brokenFileNames.forEach(([fileName, namePart]) => {
            logger.error(`Файл ${fileName} в части ${namePart} содержит символы из разных алфавитов, вероятно, это ошибка.`);
         });
         logger.error('Найдены файлы, в названиях которых используются символы из разных алфавитов.');
         throw new Error();
      }
   }
}

module.exports = AmbiguousNames;
