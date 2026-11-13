const UI = require('./UI');

/**
 * Класс модуля с демо-примерами.
 */
class Demo extends UI {
   constructor(cfg) {
      super(cfg);

      this.enableAutodoc = false;
      this.type = 'demo';
   }
}

module.exports = Demo;
