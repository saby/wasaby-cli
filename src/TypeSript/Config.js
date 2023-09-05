const pathUtils = require('../Utils/path');
const fs = require('fs-extra');

/**
 * All of requirejs substitutions that are useful for
 * interface module WS.Core
 * @type {Map<string, string>}
 */
const REQUIRE_JS_SUBSTITUTIONS = new Map([
   ['WS', ''],
   ['Core', 'core'],
   ['Lib', 'lib'],
   ['Ext', 'lib/Ext'],
   ['Helpers', 'core/helpers'],
   ['Transport', 'transport']
]);
const DEFAULT_PARENT_CONFIG_PATH = require.resolve('saby-typescript/configs/es5.dev.json');

const DEFAULT_TYPE = 'common';
const COMMON_TYPES = ['requirejs'];
const TYPES = {
   Jest: ['jest', 'sinon', ...COMMON_TYPES],
   WebDriverIO: ['webdriverio/async', '@wdio/mocha-framework', 'expect-webdriverio', ...COMMON_TYPES],
   Mocha: ['mocha', 'sinon', 'chai', ...COMMON_TYPES],
   common: COMMON_TYPES,
   build: ['mocha', 'requirejs', 'jest']
};

class Config {
   constructor(cfg) {
      this.root = cfg.root;
      this.path = pathUtils.join(this.root, 'tsconfig.json');

      this.options = {
         extends: pathUtils.normalize(cfg.pathParentConfig || DEFAULT_PARENT_CONFIG_PATH),
         compilerOptions: {
            types: TYPES[cfg.type || DEFAULT_TYPE],
            baseUrl: '.'
         }
      };

      if (cfg.exclude) {
         this.options.exclude = cfg.exclude;
      }

      if (cfg.include) {
         this.options.include = [
            '**/*.ts',
            '**/*.tsx',
            ...cfg.include
         ];
      }

      this._buildPaths(cfg.modules);
   }

   async save() {
      await fs.outputFile(this.path, JSON.stringify(this.options, null, 3));
   }

   /**
    * Возвращает пути до модулей
    * @returns {void}
    * @private
    */
   _buildPaths(modules) {
      if (!modules) {
         return;
      }

      this.options.compilerOptions.paths = {
         tslib: [
            pathUtils.normalize(require.resolve('saby-typescript/tslib.d.ts'))
         ]
      };

      for (const module of modules) {
         if (module.name === 'WS.Core') {
            this._buildPathsForWSCore(module);

            continue;
         }

         this.options.compilerOptions.paths[`${module.name}/*`] = [`${module.path}/*`];
      }
   }

   _buildPathsForWSCore(module) {
      for (const [key, value] of REQUIRE_JS_SUBSTITUTIONS) {
         this.options.compilerOptions.paths[`${key}/*`] = [pathUtils.join(module.path, value, '*')];
      }
   }
}

module.exports = Config;
