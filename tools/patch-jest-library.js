'use strict';

const path = require('path');
const fs = require('fs/promises');

const TARGET_FILE_PATH = require.resolve('@jest/snapshot-utils');
const SOURCE_FILE_PATH = path.join(__dirname, 'snapshot-utils.js');

async function main() {
   await fs.rename(TARGET_FILE_PATH, TARGET_FILE_PATH.replace('/index.js', '/index.origin.js'));
   await fs.cp(SOURCE_FILE_PATH, TARGET_FILE_PATH);
}

const startTime = Date.now();

main()
   .catch(console.error)
   .finally(() => {
      const duration = Math.ceil((Date.now() - startTime) / 1000);

      console.log(`Finished patching @jest/snapshot-utils after ${duration} s.`);

      return process.exit(0);
   });
