const Module = require('./Module');

/**
 * Класс BL модуль.
 */
class BL extends Module {
   constructor(cfg) {
      super(cfg);

      this.type = 'bl';
   }
}

module.exports = BL;
