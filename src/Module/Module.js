const EMPTY_STRING = '';
const xml = require('../Utils/xml');
const pathUtils = require('../Utils/path');
const logger = require('../Utils/Logger');

function extractModuleList(features) {
   const result = [];

   for (const feature of features) {
      result.push(feature.$.name);
   }

   return result;
}

/**
 * Разобрать блок <typescript>...</typescript>, который содержит элементы вида:
 * <arg key="название" value="значение"/>
 * @param typescript xml узел, содержащий данные.
 * @returns {object} Возвращает словарь свойств блока typescript со значениями "как есть".
 */
function extractTypescriptProperties(typescript) {
   const result = { };

   if (Array.isArray(typescript)) {
      typescript.forEach(({ arg }) => {
         if (Array.isArray(arg)) {
            arg.forEach(({ $ }) => {
               result[$.key] = $.value;
            });
         }
      });
   }

   return result;
}

/**
 * Класс модуль.
 *
 * Объект с настройками TypeScript.
 * @typedef {Object} TypeScriptCfg
 * @property {boolean} [typecheck=true] Включать ли тайпчек.
 */
class Module {
   /**
    * @param cfg.type {String} Тип модуля.
    * @param cfg.id {String} Уникальный идентификатор модуля.
    * @param cfg.name {String} Имя модуля.
    * @param cfg.s3mod {String} Абсолютный путь к s3mod-файлу.
    * @param cfg.path {String} Директория модуля.
    * @param cfg.package {String} Имя пакета, в который входит модуль.
    * @param cfg.kaizen {String} ID кайзен зоны, в которую входит модуль.
    * @param cfg.loadAfter {String[]} Список имён модулей, после которых нужно грузить модуль.
    * @param cfg.repository {Repository} Репозитория, содержащий модуль.
    * @param cfg.revision {String} Стабильная ревизия модуля.
    * @param cfg.depends {Array<String>} Массив имен модулей, от которых зависит данный модуль.
    * @param cfg.required {Boolean} Модуль необходим для builder.
    * @param cfg.forCDN {Boolean} Является ли модуль CDN хронилящем тестами.
    * @param [cfg.unitTest] {Boolean} Является ли модуль юнит тестами.
    * @param [cfg.featuresProvided] {Array<String>} Предоставляемые модулем фичи.
    * @param [cfg.featuresRequired] {Array<String>} Необходимые фичи для модуля.
    * @param [cfg.typescript] {TypeScriptCfg} Объект с настройками TypeScript.
    */
   constructor(cfg) {
      this.type = 'module';

      this.id = cfg.id || EMPTY_STRING;
      this.name = cfg.name;
      this.s3mod = cfg.s3mod;
      this.path = cfg.path;
      this.repository = cfg.repository || null;
      this.revision = cfg.revision || null;
      this.depends = cfg.depends || [];
      this.package = cfg.package;

      // TODO Добавляем зависимости, которые невозможно внедрить на уровне s3mod.
      this._addCyclicDependencies();

      this.required = cfg.required;
      this.forCDN = cfg.forCDN;

      this.featuresProvided = cfg.featuresProvided;
      this.featuresRequired = cfg.featuresRequired;

      this.loadAfter = cfg.loadAfter;

      this.kaizen = cfg.kaizen;
      this.typescript = cfg.typescript;
   }

   merge(module) {
      this.type = module.type;

      this.id = module.id;
      this.name = module.name;
      this.s3mod = module.s3mod;
      this.path = module.path;
      this.repository = module.repository;
      this.revision = module.revision;
      this.depends = module.depends;
      this.package = module.package;

      this.required = module.required;
      this.forCDN = module.forCDN;

      this.featuresProvided = module.featuresProvided;
      this.featuresRequired = module.featuresRequired;

      this.loadAfter = module.loadAfter;
      this.typescript = module.typescript;
   }

   /**
    * Обновить ревизию модуля.
    * @returns {void}
    */
   updateRevision() {
      this.revision = this.repository.HEAD;
   }

   /**
    * Получить список измененных файлов в данном модуле.
    * @param revision {String} Коммит от которого искать изменения.
    * @returns {Promise<Object>}
    */
   async getChangedFiles(revision) {
      if (!this.repository) {
         throw new Error(`Module ${this.name} not has Repository instance`);
      }

      const checkPath = `${this.path}/`;
      const allChangedFiles = await this.repository.getChangedFiles(revision);

      const result = {
         changed: allChangedFiles.changed.filter(changedFile => changedFile.startsWith(checkPath)),
         deleted: allChangedFiles.deleted.filter(deletedFile => deletedFile.startsWith(checkPath))
      };

      logger.debug(
         `Changed files for module "${this.name}" and commit "${revision}": ${JSON.stringify(result, null, 3)}`
      );

      return result;
   }

   /**
    * Получить сериализуемую часть инстанса.
    * @returns {Object} Сериализуемое содержимое инстанса.
    */
   serialize() {
      return {
         type: this.type,
         id: this.id,
         name: this.name,
         s3mod: this.s3mod,
         path: this.path,
         repository: this.repository.name || this.repository,
         revision: this.revision,
         depends: this.depends,
         required: this.required,
         forCDN: this.forCDN,
         featuresProvided: this.featuresProvided,
         featuresRequired: this.featuresRequired,
         loadAfter: this.loadAfter,
         kaizen: this.kaizen,
         package: this.package,
         typescript: this.typescript
      };
   }

   _addCyclicDependencies() {
      // TODO удалить как удалят WS.Core
      // У ws.core невозможно указать зависимости из-за циклической зависимостей.
      if (this.name === 'WS.Core') {
         this.depends = [...this.depends, 'Types', 'Env', 'View', 'Vdom', 'UI', 'Browser'];
      }

      // TODO Удалить после закрытия задачи
      // Нельзя физически добавить в UI зависимость SbisEnvUI, из-за циклической зависимости подробности в диалоге.
      // https://online.sbis.ru/open_dialog.html?guid=960a2040-f9aa-49ec-a361-ff4120536ddd
      if (this.name === 'UI') {
         this.depends.push('SbisEnvUI');
      }
   }

   buildAst() {
      const ast = {
         ui_module: {
            $: {
               name: this.name,
               id: this.id
            },
            depends: [
               {
                  module: []
               }
            ]
         }
      };

      if (this.forCDN) {
         ast.ui_module.$.for_cdn = '1';
      }

      return ast;
   }

   async save() {
      await xml.writeXmlFile(this.s3mod, this.buildAst());
   }

   static buildModuleFromObject(moduleInfo) {
      const Test = require('./Test');
      const Demo = require('./Demo');
      const UI = require('./UI');
      const BL = require('./BL');

      switch (moduleInfo.type) {
         case 'ui':
            return new UI(moduleInfo);
         case 'test':
            return new Test(moduleInfo);
         case 'demo':
            return new Demo(moduleInfo);
         case 'bl':
            return new BL(moduleInfo);
      }
   }

   static async buildModuleFromXml(path, defaultOptions) {
      const module = await xml.readXmlFile(path);
      const type = module.hasOwnProperty('ui_module') ? 'ui_module' : 'bl_module';
      const moduleInfo = {
         type,
         s3mod: path,
         path: pathUtils.dirname(path),
         id: module[type].$.id,
         name: module[type].$.name,
         depends: [],
         forCDN: module[type].$.for_cdn && module[type].$.for_cdn !== '0',
         required: module[type].$.required && module[type].$.required !== '0',

         kaizen: {
            id: module[type].$.kaizen_zone,
            uuid: module[type].$.kaizen_zone_uuid,
            responsible: module[type].$.responsible,
            responsibleUuid: module[type].$.responsible_uuid
         },
         package: module[type].$.package,
         typescript: extractTypescriptProperties(module[type].typescript),
         ...defaultOptions
      };

      if (module[type].depends && module[type].depends[0]) {
         const depends = module[type].depends[0];

         if (depends.ui_module) {
            depends.ui_module.forEach((item) => {
               moduleInfo.depends.push(item.$.name);
            });
         }

         if (depends.module) {
            depends.module.forEach((item) => {
               moduleInfo.depends.push(item.$.name);
            });
         }
      }

      if (module[type].features_provided) {
         moduleInfo.featuresProvided = extractModuleList(module[type].features_provided[0].feature);
      }

      if (module[type].features_required) {
         moduleInfo.featuresRequired = extractModuleList(module[type].features_required[0].feature);
      }

      if (module[type].load_after && module[type].load_after[0]) {
         moduleInfo.loadAfter = extractModuleList([
            ...(module[type].load_after[0].module || []),
            ...(module[type].load_after[0].bl_module || [])
         ]);
      }

      if (moduleInfo.name.endsWith('-demo')) {
         moduleInfo.type = 'demo';

         return Module.buildModuleFromObject(moduleInfo);
      }


      if (module[type].test || module[type].unit_test) {
         const testsInfo = (module[type].test || module[type].unit_test)[0].$ || {};

         moduleInfo.type = 'test';
         moduleInfo.environment = testsInfo.environment;
         moduleInfo.framework = testsInfo.framework;
         moduleInfo.needRunTestInBrowser = testsInfo.needRunTestInBrowser;

         return Module.buildModuleFromObject(moduleInfo);
      }

      moduleInfo.type = type === 'ui_module' ? 'ui' : 'bl';

      return Module.buildModuleFromObject(moduleInfo);
   }
}

module.exports = Module;
