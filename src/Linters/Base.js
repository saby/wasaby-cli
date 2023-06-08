const pathUtils = require('../Utils/path');
const fs = require('fs-extra');
const pMap = require('p-map');

const logger = require('../Utils/Logger');
const CMD = require('../Utils/CMD');

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

class Base {
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
      this.cmd = new CMD();
   }

   buildFile() {
      if (this.file) {
         return this.file;
      }

      if (this.config) {
         return `module.exports = ${JSON.stringify(this.config, null, 3)};`;
      }
   }

   async init() {
      try {
         logger.info(`Creating ${this.name} configuration.`);

         await fs.writeFile(this.path, this.buildFile());
      } catch (err) {
         logger.error(`Error creating ${this.name} config from ${this.source} to ${this.path}:  ${err}`);
      }
   }

   async start(files) {
      const binFile = this.getBinFile();

      if (binFile) {
         const command = `node ${binFile} ${this.commandFlags}`;
         const chunks = this.buildChunkFiles(files, maxArgLength - command.length + 1);

         await pMap(chunks, async(chunk) => {
            if (chunk) {
               await this.cmd.execute(`${command} ${chunk}`);
            }
         });
      }
   }

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
   }
}

module.exports = Base;
