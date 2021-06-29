const Shell = require('./util/shell');
const ModulesMap = require('./util/modulesMap');

/**
 * Базовый класс
 * @class Base
 * @author Ганшин Я.О
 */

class Base {
   constructor(cfg) {
      this.options = cfg.options;
      this._shell = new Shell();
      this._modulesMap = new ModulesMap({
         options: this.options,
         reBuildMap: cfg.reBuildMap,
         useOnlyCache: cfg.useOnlyCache
      });
   }

   async run() {
      try {
         await this._modulesMap.build();
         await this._run();
      } catch (e) {
         await this._shell.closeChildProcess();
         throw e;
      }
   }

   // eslint-disable-next-line class-methods-use-this,require-await
   async _run() {
      throw new Error('method _run must be impemented');
   }
}

module.exports = Base;
