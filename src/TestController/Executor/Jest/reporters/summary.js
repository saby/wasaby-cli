'use strict';

const { SummaryReporter } = require('@jest/reporters');

// Jest-овский reporter пишет все логи в stderr, поэтому приходиться перебивать его более адекватной логикой
class WasabySummaryReporter extends SummaryReporter {
   constructor(globalConfig, options) {
      super(globalConfig, options);

      this._hasFailures = false;

      // log method is called from
      // ./node_modules/@jest/reporters/build/SummaryReporter.js
      // with loosing its context
      this.log = this._log.bind(this);
   }

   _write(string) {
      super._write(string)
      // little hack in order to detect if there was a failure
      // the _write method will only be called if there was a failure
      // ./node_modules/@jest/reporters/build/SummaryReporter.js
      this._hasFailures = true;
   }

   _log(message) {
      if (this._hasFailures) {
         process.stderr.write(`${message}\n`);
      } else {
         process.stdout.write(`${message} \n`);
      }
   }
};

module.exports = WasabySummaryReporter;