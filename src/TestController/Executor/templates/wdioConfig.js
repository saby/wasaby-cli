const crypto = require('node:crypto');
const path = require('node:path');
const fs = require('node:fs/promises')

const requirejsUmd = require('/*#UNITS_LIB_PATH#*//jest/require-umd.js');
const {getWsConfig, getRequireJsConfigPath} = require('/*#UNITS_LIB_PATH#*//ws/wsConfig.js');
const loadContents = require('/*#UNITS_LIB_PATH#*//ws/loadContents.js');
const setupRequireJs = require('/*#UNITS_LIB_PATH#*//ws/setup.js').requireJs;

const excludeTests = [/*#EXCLUDE_TESTS#*/];
const includeTests = [/*#INCLUDE_TESTS#*/];
const testNamePattern = /*#TEST_NAME_PATTERN#*/;

const logs = {};

function getFullNameTest(test) {
   if (test.parent) {
      const fullName = getFullNameTest(test.parent);

      return `${fullName ? `${fullName}.`: ''}${test.title}`;
   }

   return test.title;
}

function skipTest(test) {
   try {
      test.skip();
   } catch (err) {
      // Функцию skip() предполагается использовать внутри it, поэтому она генерит исключение,
      // чтобы остановить исполнения кода внутри it. Но мы используем её внутри хука, поэтому глушим ошибку про скип.
      if (err.message !== 'sync skip; aborting execution') {
         throw err;
      }
   }
}

module.exports.config = {
   beforeSession: () => {
      global.wsConfig = getWsConfig(/*#RESOURCE_ROOT#*/, {
         resourcePath: '',
         wsPath: '',
         appPath: /*#RESOURCE_ROOT#*/ + '/',
         loadCss: false
      });

      global.contents = loadContents(/*#RESOURCE_ROOT#*/);

      global.requirejs = requirejsUmd;
      global.define = requirejsUmd.define;

      try {
         // Setup RequireJS
         const configPath = getRequireJsConfigPath(/*#RESOURCE_ROOT#*/);

         if (configPath) {
            setupRequireJs(
               global.requirejs,
               path.resolve(path.join(/*#RESOURCE_ROOT#*/, configPath)),
               /*#RESOURCE_ROOT#*/,
               [],
               global.wsConfig.wsRoot,
               global.contents
            );
         }
      } catch (error) {
         throw (error.originalError || error);
      }
   },

   beforeHook: (test, context) => {
      const fullName = getFullNameTest(context.test);

      if (testNamePattern && !testNamePattern.test(fullName)) {
         skipTest(context);

         return;
      }

      if (includeTests.length !== 0 && !includeTests.includes(fullName)) {
         skipTest(context);

         return;
      }

      if (excludeTests.includes(fullName)) {
         skipTest(context);
      }
   },

   beforeTest: async(test, context) => {
      const fullName = getFullNameTest(context.test);

      logs[fullName] = [];

      browser.on('Runtime.consoleAPICalled', (log) => {
         logs[fullName].push(log);
      });
   },

   afterTest: async(test, context, { error, result, duration, passed, retries }) => {
      const fullName = getFullNameTest(context.test);
      const id = crypto.createHash('md5').update(fullName).digest('hex');

      if (/*#SCREENSHOT_ENABLE#*/ && error && passed === false) {
         await browser.saveScreenshot(`/*#SCREENSHOTS_DIR#*//${id}.png`);
      }

      await fs.writeFile(`/*#BROWSER_LOGS_DIR#*//${id}.json`, JSON.stringify(logs[fullName], null, 2));

      const windows = await browser.getWindowHandles();

      for (let i = windows.length - 1; i >= 1; i--) {
         await browser.switchToWindow(windows[i]);
         await browser.closeWindow();
      }

      await browser.switchToWindow(windows[0]);
   },
   /*#MAIN_CONFIG#*/
};
