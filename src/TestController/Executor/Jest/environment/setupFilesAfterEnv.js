'use strict';

const path = require('node:path');
const { existsSync } = require('node:fs');
const { configure } = require('@testing-library/dom');

const setupLogger = require('./logger').setup;
const loadContents = require('./loadContents');
const setupRequireJs = require('./setup').requireJs;
const { getWsConfig, getRequireJsConfigPath } = require('./wsConfig');

const wsConfig = getWsConfig(__SABY_APPLICATION_DIRECTORY__, {
   resourcePath: '',
   wsPath: '',
   appPath: __SABY_APPLICATION_DIRECTORY__ + '/',
   loadCss: __SABY_LOAD_CSS__
});
global.wsConfig = wsConfig;

const contents = loadContents(__SABY_APPLICATION_DIRECTORY__);
global.contents = contents;

const requirejs = require('./r.js');
global.requirejs = requirejs;
global.define = requirejs.define;

try {
   // Setup RequireJS
   const configPath = getRequireJsConfigPath(__SABY_APPLICATION_DIRECTORY__);

   if (configPath) {
      const requirejsConfigPath = path.resolve(path.join(__SABY_APPLICATION_DIRECTORY__, configPath));

      setupRequireJs(requirejs, requirejsConfigPath, __SABY_APPLICATION_DIRECTORY__, [], wsConfig.wsRoot, contents);
   }

   // Setup logger
   setupLogger(requirejs);
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
   const jquery = require('cdn/JQuery/jquery/3.3.1/jquery-min.js');

   global.$ = jquery;
   global.jQuery = jquery;
}

let AppInit;
if (existsSync(path.join(__SABY_APPLICATION_DIRECTORY__, 'Application/Application.s3mod'))) {
   AppInit = require('Application/Initializer');
   AppInit.default(wsConfig);

   // создаем новый Request для каждого test-case
   const fakeReq = { };
   const fakeRes = { };

   AppInit.startRequest(void 0, void 0, () => fakeReq, () => fakeRes);
}

// Initialize i18n controller
const { controller } = global.requirejs('I18n/i18n');

// В jenkins тесты по веткам собираются с локализацией.
// Так как вся локализация живёт на плагине Require.js "i18n!",
// а они в umd не работают, то отключим локализацию в unit-ах насильно.
controller.availableLocales = [];

for (const locale of ['en-US', 'en-GB', 'ru-RU', 'ar-AE', 'he-IL']) {
   controller.addLocale(locale, global.requirejs('I18n/locales/' + locale).default, false);
}

configure({
   testIdAttribute: 'data-qa'
});
