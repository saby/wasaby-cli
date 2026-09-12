'use strict';

const path = require('node:path');
const { existsSync } = require('node:fs');
const { configure } = require('@testing-library/dom');

const setupLogger = require('./logger').setup;
const loadContents = require('./loadContents');

const contents = loadContents(__SABY_APPLICATION_DIRECTORY__);
global.contents = contents;

require(path.join(__SABY_APPLICATION_DIRECTORY__, 'RequireJsLoader/third-party/ServerRequire.js'));

global.wsConfig = {
   resourceRoot: '/resources/',
   metaRoot: '/',
   // TODO какой не костялга, без которог оне работают юниты. Без него начинают грузиться полифилы, который ронят всё.
   unitTestMode: true,
};

global.initRequire(__SABY_APPLICATION_DIRECTORY__, '/');

global.wsConfig.metaRoot = '/resources/';

try {
   // Setup logger
   setupLogger(global.requirejs);
} catch (error) {
   throw (error.originalError || error);
}

/* Compatibility with Mocha */
global.before = global.beforeAll;
global.after = global.afterAll;

global.assert = require('chai').assert;
global.sinon = require('sinon');

// Устанавливает id для набора тестов описанных в файле.
global.setTestID = (id) => {
   global.testID = id;
};

if (typeof document !== 'undefined') {
   Object.defineProperty(global, '$', {
      get() {
         return global.requirejs('jquery');
      },
      enumerable: false
   });
   Object.defineProperty(global, 'jQuery', {
      get() {
         return global.requirejs('jquery');
      },
      enumerable: false
   });
}

let AppInit;
if (existsSync(path.join(__SABY_APPLICATION_DIRECTORY__, 'Application/Application.s3mod'))) {
   AppInit = require('Application/Initializer');
   AppInit.default(global.wsConfig);

   // создаем новый Request для каждого test-case
   const fakeReq = { };
   const fakeRes = { };

   AppInit.startRequest(void 0, void 0, () => fakeReq, () => fakeRes);
}

// Initialize i18n controller
const { controller, Translator } = global.requirejs('I18n/i18n');

// В jenkins тесты по веткам собираются с локализацией.
// Так как вся локализация живёт на плагине Require.js "i18n!",
// а они в umd не работают, то отключим локализацию в unit-ах насильно.
controller.availableLanguages = [];

const originTranslate = Translator.prototype.translate;

Translator.prototype.translate = function(...args) {
   const res = originTranslate.apply(this, args);

   return res ? `${res}` : res;
}

controller.addRegion('RU', global.requirejs('LocalizationConfigs/localization_configs/region/RU.json'), false);

for (const lang of ['en', 'ru', 'ar', 'he', 'uz', 'kk', 'fr']) {
   controller.addLang(lang, global.requirejs(`I18n/locales/${lang}`).default, false);
}


const ModulesLoader = global.requirejs('WasabyLoader/ModulesLoader');
const originLoadAsync = ModulesLoader.loadAsync;

ModulesLoader.loadAsync = function(...args) {
   let resolve;
   let reject;
   const prom = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
   });

   originLoadAsync(...args).then((result) => {
      globalThis.queueMicrotask(() => {resolve(result)});
   }, reject);

   return prom;
}

const {constants} = global.requirejs('Env/Env');

constants.resourceRoot = '/';

configure({
   testIdAttribute: 'data-qa'
});

function redirect(method) {
   return function(recieved, ...args) {
      try {
         if (this.isNot) {
            expect(recieved).not[method](...args);
            return {
               pass: false,
               message: ''
            };
         }

         expect(recieved)[method](...args);
         return {
            pass: true,
            message: ''
         };
      } catch (error) {
         return {
            pass: this.isNot,
            message: error.message
         };
      }
   }
}

expect.extend({
   toBeCalled: redirect('toHaveBeenCalled'),
   toBeCalledTimes: redirect('toHaveBeenCalledTimes'),
   toBeCalledWith: redirect('toHaveBeenCalledWith'),
   lastCalledWith: redirect('toHaveBeenLastCalledWith'),
   nthCalledWith: redirect('toHaveBeenNthCalledWith'),
   toReturn: redirect('toHaveReturned'),
   toReturnTimes: redirect('toHaveReturnedTimes'),
   toReturnWith: redirect('toHaveReturnedWith'),
   lastReturnedWith: redirect('toHaveLastReturnedWith'),
   nthReturnedWith: redirect('toHaveNthReturnedWith'),
   toThrowError: redirect('toThrow'),
});
