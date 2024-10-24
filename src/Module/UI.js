const Module = require('./Module');

/**
 * Класс интерфейсного модуля.
 */
class UI extends Module {
   constructor(cfg) {
      super(cfg);

      this.type = 'ui';
   }

   buildAst() {
      const ast = super.buildAst();

      ast.ui_module.typescript = [{
         arg: [{
            $: {
               key: 'typecheck',
               value: this.typescript.typecheck
            }
         }]
      }];

      return ast;
   }
}

module.exports = UI;
