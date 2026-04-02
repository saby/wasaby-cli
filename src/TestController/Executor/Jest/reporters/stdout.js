'use strict';

const { DefaultReporter } = require('@jest/reporters');

// Jest-овский reporter пишет все логи в stderr, поэтому приходиться перебивать его более адекватной логикой
class WasabyDefaultReporter extends DefaultReporter {
   log(message) {
      if (message.includes('FAIL ')) {
         process.stderr.write(`${message}\n`);
      } else {
         process.stdout.write(`${message}\n`);
      }
   }
};

module.exports = WasabyDefaultReporter;
