'use strict';

const { DefaultReporter } = require('@jest/reporters');

// Jest-овский reporter пишет все логи в stderr, поэтому приходиться перебивать его более адекватной логикой
class WasabyDefaultReporter extends DefaultReporter {
   onTestResult(test, testResult, aggregatedResults) {
      super.onTestResult.apply(this, arguments);
      testResult.console?.forEach(({ type, message }) => {
         if (type === 'error') {
            // это приведёт к повторам сообщений, но иначе придётся самим стилизоваться под вывод jest
            // красить текст, добавлять отступы и т.п.
            process.stderr.write(`${message}\n`);
            this.forceFlushBufferedOutput();
         }
      });
   }

   log(message) {
      if (message.includes('FAIL ')) {
         process.stderr.write(`${message}\n`);
      } else {
         process.stdout.write(`${message}\n`);
      }
   }
}

module.exports = WasabyDefaultReporter;
