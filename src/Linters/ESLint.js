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
      this.path = pathUtils.join(root, 'eslint.config.js');
      this.source = pathUtils.join(this.pathToConfigStore, 'eslint', 'base.js');
      this.tsconfig = new TSConfig({
         root: logger.dir,
         pathParentConfig: tsconfigPath,
         include: []
      });

      const dirname = pathUtils.dirname(this.path);
      const ignorePatterns = ignorePaths.map((path) => {
         return `"${pathUtils.join('./', path.replace(dirname, ''), '/')}"`;
      });

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

      const overrides = [];

      if (Object.keys(overridenRules).length > 0) {
         for (const [path, rules] of Object.entries(overridenRules)) {
            const extension = getExtension(path);
            const files = extension === path ? [`**/*${extension}`] : [path];

            if (extension === '.ts') {
               // Если правило указано для тс, дублируем его ещё и для tsx
               files.push(files[0] + 'x');
            }

            overrides.push(JSON.stringify({
               files,
               rules
            }));
         }
      }

      this.file = `const {defineConfig, globalIgnores} = require("eslint/config");
const parentConfig = require("${this.source}");
module.exports = defineConfig([parentConfig, {
         files: ['**/*.ts', '**/*.tsx'],
         languageOptions: {
            parserOptions: {
               projectService: true,
               jsDocParsingMode: 'none'
            }
         }
      }, ${overrides.length > 0 ? overrides.join(',') + ',' : ''} globalIgnores([${[
         ignorePatterns,
         '".prettierrc.js"',
         '"eslint.config.js"',
         '".stylelintrc.js"',
         '"tailwind.config.js"'
      ]}])])`;

      this.extensions = [
         'ts',
         'js',
         'tsx',
         'jsx'
      ];

      this.commandFlags = `--quiet --no-config-lookup --no-color --config ${this.path}`;
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
