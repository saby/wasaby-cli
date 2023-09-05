const pathUtils = require('../Utils/path');
const fs = require('fs-extra');
const pMap = require('p-map');

const logger = require('../Utils/Logger');
const ChildProcess = require('../Utils/ChildProcess');

const maxArgLength = (() => {
   switch (process.platform) {
      case 'darwin':
         return 13172;
      case 'win32':
         return 4895;
      default:
         return 65531;
   }
})();

/**
 * Базовый класс для сущностей Linter. Реализует базовые методы, необходимые всем линтерам.
 * @class Linter
 */
class Linter {
   constructor() {
      this.name = 'Linter';
      this.namePackage = 'linter';
      this.pathToConfigStore = pathUtils.dirname(require.resolve('saby-typescript/package.json'));
      this.source = '';
      this.path = '';
      this.file = '';
      this.config = '';
      this.commandFlags = '';
      this.extensions = [];
   }

   /**
    * Собирает конфигурацию в виде строки.
    * @returns {String}
    */
   buildFile() {
      if (this.file) {
         return this.file;
      }

      if (this.config) {
         return `module.exports = ${JSON.stringify(this.config, null, 3)};`;
      }

      return '';
   }

   /**
    * Записывает конфигурационный файл по указанному пути.
    * @returns {Promise<void>}
    */
   async init() {
      try {
         logger.info(`Creating ${this.name} configuration.`);

         await fs.writeFile(this.path, this.buildFile());
      } catch (err) {
         logger.error(`Error creating ${this.name} config from ${this.source} to ${this.path}:  ${err}`);
      }
   }

   /**
    * Запускает линтер по указанным файлам.
    * @param files {String[]} Список файлов, по которы нужно прогнать линтер.
    * @returns {Promise<void>}
    */
   async start(files) {
      const binFile = this.getBinFile();

      if (binFile) {
         const command = `node ${binFile} ${this.commandFlags}`;
         const chunks = this.buildChunkFiles(files, maxArgLength - command.length + 1);

         await pMap(chunks, async(chunk) => {
            if (chunk) {
               const linter = new ChildProcess({
                  commandLine: `${command} ${chunk}`
               });

               await linter.run();
            }
         }, {
            concurrency: 1,
            stopOnError: false
         });
      }
   }

   /**
    * Разбивает список файлов на чанки по длине строки, допустимой в терминале.
    * @param files {String[]} Список путей до файлов.
    * @param sizeChunk {Number} Допустимый размер строки для чанка.
    * @param [root] {String} Путь до директории, относительно которой расположены файлы.
    * @returns {String[String[]]}
    */
   buildChunkFiles(files, sizeChunk, root = process.cwd()) {
      const chunks = [''];
      let chunkNumber = 0;

      for (const file of files) {
         const extension = file.substring(file.lastIndexOf('.') + 1);

         if (this.extensions.includes(extension)) {
            const arg = `"${pathUtils.relative(root, file)}" `;

            if (chunks[chunkNumber].length + arg.length > sizeChunk) {
               chunkNumber++;
               chunks[chunkNumber] = '';
            }

            chunks[chunkNumber] += arg;
         }
      }

      return chunks;
   }

   /**
    * Возвращает путь до исполняемого файла литера.
    * @returns {String}
    */
   getBinFile() {
      try {
         const pathToPackage = require.resolve(`${this.namePackage}/package.json`);
         const bin = require(pathToPackage).bin;

         if (typeof bin === 'string') {
            return pathUtils.join(pathUtils.dirname(pathToPackage), bin);
         }
         if (bin && bin[this.namePackage]) {
            return pathUtils.join(pathUtils.dirname(pathToPackage), bin[this.namePackage]);
         }
      } catch (err) {
         logger.error(err);
      }

      return '';
   }
}

module.exports = Linter;
