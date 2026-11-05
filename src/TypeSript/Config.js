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
const DEFAULT_PARENT_CONFIG_PATH = require.resolve('saby-typescript/configs/strict.json');

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
         extends: `./${pathUtils.relative(this.root,cfg.pathParentConfig || DEFAULT_PARENT_CONFIG_PATH)}`,
         compilerOptions: {
            types: TYPES[cfg.type || DEFAULT_TYPE]
         }
      };

      if (!cfg.pathParentConfig) {
         this.options.compilerOptions.baseUrl = '.';
      }

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

      if (cfg.typeRoots) {
         this.options.compilerOptions.typeRoots = cfg.typeRoots;
      }

      if (cfg.modules) {
         this.options.compilerOptions.paths = this._buildPaths(cfg.modules);
      }
   }

   async save() {
      const content = JSON.stringify(this.options, null, 3);

      if (fs.existsSync(this.path)) {
         const original = await fs.readFile(this.path, 'utf8');

         if (original !== content) {
            await fs.outputFile(this.path, content);
         }
      } else {
         await fs.outputFile(this.path, content);
      }
   }

   /**
    * Возвращает пути до модулей
    * @returns {Record<string, string[]>}
    * @private
    */
   _buildPaths(modules) {
      const paths = {
         tslib: [
            `./${pathUtils.relative(this.root, require.resolve('saby-typescript/tslib.d.ts'))}`
         ]
      };

      for (const module of modules) {
         if (module.name === 'WS.Core') {
            for (const [key, value] of REQUIRE_JS_SUBSTITUTIONS) {
               paths[`${key}/*`] = ['./' + pathUtils.join(pathUtils.relative(this.root, module.path), value, '*')];
            }

            continue;
         }

         if (module.name === 'Clsx') {
            paths.clsx = ['./' + pathUtils.join(pathUtils.relative(this.root, module.path), 'third-party', 'clsx.d.ts')];

            continue;
         }

         // типы для библиотеки pixi и pixi-react расположены в Typescript/types
         if (module.name === 'Typescript') {
            paths.pixi = ['./' + pathUtils.join(pathUtils.relative(this.root, module.path), 'types', 'pixi')];
            paths['pixi/*'] = ['./' + pathUtils.join(pathUtils.relative(this.root, module.path), 'types', 'pixi', '*')];
            paths['pixi-react'] = ['./' + pathUtils.join(pathUtils.relative(this.root, module.path), 'types', 'pixi-react')];
         }

         paths[`${module.name}/*`] = [`./${pathUtils.relative(this.root, module.path)}/*`];
      }

      return Object.fromEntries(Object.entries(paths).sort());
   }
}

module.exports = Config;
