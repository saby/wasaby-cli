const pathUtils = require('../Utils/path');
const TSConfig = require('./../TypeSript/Config');
const Linter = require('./Linter');
const logger = require('../Utils/Logger');

const OVERRIDABLE_RULES = new Map([
   ['.ts', new Set([
      '@typescript-eslint/no-floating-promises',
      '@typescript-eslint/no-restricted-imports',
      'react-hooks/rules-of-hooks',
      'react-hooks/exhaustive-deps',
   ])],
   ['.tsx', new Set([
      '@typescript-eslint/no-floating-promises',
      '@typescript-eslint/no-restricted-imports',
   ])],
   ['.test.tsx', new Set([
      'testing-library/await-async-queries',
      'testing-library/await-async-utils',
      'testing-library/no-await-sync-queries',
      'testing-library/no-debugging-utils',
      'testing-library/no-dom-import',
      'testing-library/no-global-regexp-flag-in-query',
      'testing-library/no-manual-cleanup',
      'testing-library/no-promise-in-fire-event',
      'testing-library/no-unnecessary-act',
      'testing-library/no-wait-for-multiple-assertions',
      'testing-library/no-wait-for-side-effects',
      'testing-library/no-wait-for-snapshot',
      'testing-library/prefer-find-by',
      'testing-library/prefer-presence-queries',
      'testing-library/prefer-query-by-disappearance',
      'testing-library/prefer-screen-queries',
   ])],
]);

/**
 * Конфигурация для ESLinter.
 * @extends Linter
 * @class ESLint
 */
class ESLint extends Linter {
   /**
    * Конструктор конфигурации ESLinter.
    * @param options {Object} Конфиг с опциями из консоли, package.json и т.п.
    * @param tsconfigPath {String} Путь до tsconfig.json
    * @param ignorePaths {String[]} Список путей, которые должны игнорироваться.
    */
   constructor(options, tsconfigPath, ignorePaths, root = process.cwd()) {
      super();

      this.name = 'ESLint';
      this.namePackage = 'eslint';
      this.path = pathUtils.join(root, '.eslintrc.js');
      this.source = pathUtils.join(this.pathToConfigStore, 'eslint', 'base.js');
      this.tsconfig = new TSConfig({
         root: logger.dir,
         pathParentConfig: tsconfigPath,
         include: []
      });

      const ignorePatterns = ignorePaths.map(path => `${path.replace(pathUtils.dirname(this.path), '')}/`);

      const optionsFromPackageJson = options.params.get('ESLint') || {};
      const overridenRules = {};

      for (const [path, rules] of Object.entries(optionsFromPackageJson)) {
         const extension = getExtension(path);
         if (!OVERRIDABLE_RULES.has(extension)) {
            throw new Error(`Изменение правил для расширения ${extension} не поддерживается.`);
         }

         const overridableRules = OVERRIDABLE_RULES.get(extension);
         for (const [rule, value] of Object.entries(rules)) {
            if (!overridableRules.has(rule)) {
               throw new Error(`Нельзя изменять важность правила ${rule} для расширения ${extension}. Либо вы допустили ошибку в названии правила, либо ошибку в расширении, либо нужно удалить это правило из package.json`);
            }

            if (!isError(value)) {
               throw new Error(`Для правила ${rule} и пути ${path} устанавливается некорректная важность ${value}. Поддерживаемые значения важности: 'error'.`);
            }

            if (!(path in overridenRules)) {
               overridenRules[path] = {};
            }
            overridenRules[path][rule] = value;
         }
      }

      this.config = {
         ignorePatterns: [
            ...ignorePatterns,
            '.prettierrc.js',
            '.eslintrc.js',
            '.stylelintrc.js',
            'tailwind.config.js'
         ],
         extends: [
            this.source
         ],
         parserOptions: {
            project: tsconfigPath,
            jsDocParsingMode: 'none'
         }
      };

      if (Object.keys(overridenRules).length > 0) {
         this.config.overrides = [];

         for (const [path, rules] of Object.entries(overridenRules)) {
            const extension = getExtension(path);
            const files = extension === path ? [`**/*${extension}`] : [path];

            if (extension === '.ts') {
               // Если правило указано для тс, дублируем его ещё и для tsx
               files.push(files[0] + 'x');
            }

            this.config.overrides.push({
               files,
               rules
            });
         }
      }

      this.extensions = [
         'ts',
         'js',
         'tsx',
         'jsx'
      ];

      this.commandFlags = `--quiet --no-eslintrc --no-color --config ${this.path} --parser-options project:"${this.tsconfig.path}"`;
   }

   async start(files) {
      this.tsconfig.options.include = files;

      await this.tsconfig.save();
      await super.start(files);
   }
}

function isError(value) {
   if (typeof value === 'string') {
      return value === 'error';
   }
   if (Array.isArray(value)) {
      return value[0] === 'error';
   }
}

function getExtension(path) {
   return '.' + path.split('.').at(-1);
}

module.exports = ESLint;
