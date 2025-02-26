const UI = require('./UI');

// TODO Разработчик должен сам указывать в каком окружение запускать юниты. Надо предоставиь такую возможность,
//  перевести все эти репы на эти рельсы удалить сия список.
const NEED_RUN_BROWSER = [
   'sbis_ws',
   'sbis_sbis3controls',
   'sbis_rmi',
   'engine_schemeeditor'
];

const DEFAULT_ENVIRONMENT = 'NodeJS';
const DEFAULT_TESTING_FRAMEWORK = 'Jest';

const AVAILABLE_ENVIRONMENTS = [
   'NodeJS',
   'JSDOM',
   'Browser',
   'Python',
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

      // TODO убрать после отказа от Mocha или отказа от тестов в браузере.
      this.needRunTestInBrowser = cfg.needRunTestInBrowser || NEED_RUN_BROWSER.includes(this.repository.name);
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
      obj.needRunTestInBrowser = this.needRunTestInBrowser;

      return obj;
   }
}

module.exports = Test;
