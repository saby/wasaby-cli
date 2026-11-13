const UI = require('./UI');

const DEFAULT_ENVIRONMENT = 'NodeJS';
const DEFAULT_TESTING_FRAMEWORK = 'Jest';

const AVAILABLE_ENVIRONMENTS = [
   'NodeJS',
   'JSDOM',
   'Python',
   'Browser',
];
const AVAILABLE_TESTING_FRAMEWORK = [
   'Jest',
   'Mocha',
   'WebDriverIO',
   'ATF',
];

class Test extends UI {
   constructor(cfg) {
      super(cfg);

      this.type = 'test';
      this.environment = this._detectEnvironment(cfg.environment);
      this.framework = this._detectFramework(cfg.framework);
      this.enableAutodoc = false;
   }

   _detectEnvironment(userEnvironment = DEFAULT_ENVIRONMENT) {
      if (!AVAILABLE_ENVIRONMENTS.includes(userEnvironment)) {
         return DEFAULT_ENVIRONMENT;
      }

      return userEnvironment;
   }

   _detectFramework(userFramework = DEFAULT_TESTING_FRAMEWORK) {
      if (this.environment === 'Browser') {
         return 'WebDriverIO';
      }

      if (!AVAILABLE_TESTING_FRAMEWORK.includes(userFramework)) {
         return DEFAULT_TESTING_FRAMEWORK;
      }

      return userFramework;
   }

   isUnit() {
      return this.environment === 'NodeJS';
   }

   buildAst() {
      const ast = super.buildAst();

      ast.ui_module.test = [{}];

      if (this.environment !== DEFAULT_ENVIRONMENT) {
         ast.ui_module.test[0].$ = {
            environment: this.environment
         };
      }

      return ast;
   }

   serialize() {
      const obj = super.serialize();

      obj.environment = this.environment;
      obj.framework = this.framework;

      return obj;
   }
}

module.exports = Test;
