const Shell = require('./util/shell');
const ModulesMap = require('./util/modulesMap');

/**
 * Базовый класс
 * @class Base
 * @author Ганшин Я.О
 */

class Base {
   constructor(cfg) {
      this.modules = cfg.modules;
      this._shell = new Shell();
      this._options = cfg;
      this._modulesMap = new ModulesMap({
         config: cfg.config,
         store: cfg.store,
         testRep: cfg.testRep,
         resources: cfg.resources,
         only: cfg.only,
         reBuildMap: cfg.reBuildMap,
         useOnlyCache: cfg.useOnlyCache,
         entry: cfg.argvOptions.entry || cfg.config.entry,
         //TODO Убрать когда возможность задать реализацию будет из корообки.
         isReact: cfg.isReact
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
