const Module = require('./Module');

/**
 * Класс интерфейсного модуля.
 */
class UI extends Module {
   constructor(cfg) {
      super(cfg);

      this.type = 'ui';
   }
}

module.exports = UI;
