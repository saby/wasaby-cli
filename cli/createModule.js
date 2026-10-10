const Module = require('../src/Module/Module');
const pathUtils = require('../src/Utils/path');
const createGuid = require('../src/Utils/createGuid');
const WasabyCLICommand = require('../src/Utils/WasabyCLIComand');
const {Option} = require('commander');
const Config = require('../src/Utils/Config');

const options = [
   new Option(
       '--path <path>',
       'Путь до создаваемого модуля.'
   )
       .makeOptionMandatory()
       .argParser(Config.pathParser),
   new Option(
       '--kaizen <GUID>',
       'Индефикатор кайдзена, к которому относится модуль.'
   )
       .makeOptionMandatory(),
   new Option(
       '--responsible <String>',
       'ФИО ответственого за модуль.'
   )
       .makeOptionMandatory(),
    new Option(
        '--responsibleId <GUID>',
        'Индефикатор ответственого за модуль.'
    )
        .makeOptionMandatory(),
   new Option(
      '--description <String>',
      'Описание модуля'
   )
      .default(''),
   new Option(
      '--depends <GUID...>',
      'ID модулей от которых зависит модуль'
   )
      .default([]),
   new Option(
      '--package <String>',
      'Имя пакета'
   ),
   new Option(
       '--type <type>',
       'Тип модуля.'
   )
       .choices(['ui', 'test', 'demo'])
       .default('ui'),
   new Option(
       '--environment <type>',
       'В каком окружении запускать тесты.'
   )
       .choices(['NodeJS', 'Browser'])
       .default('NodeJS'),
   new Option(
      '--enableAutodoc',
      'Включить сборку автодоки для модуля.'
   )
      .default(false),
];

async function loadAndGetDeps(ids, project) {
   const depends = {};
   const notLoadedDeps = [];

   for (const id of ids) {
      const dep = project.store.modules.get(id);

      if (dep) {
         depends[id] = dep.name;
      } else {
         notLoadedDeps.push(id);
      }
   }

   if (notLoadedDeps.length !== 0) {
      const version = project.options.get('rc').replace('rc-', '');

      await project.store.loadModules(version, notLoadedDeps);

      for (const id of notLoadedDeps) {
         const dep = project.store.modules.get(id);

         if (dep) {
            depends[id] = dep.name;
            notLoadedDeps.shift();
         }
      }
   }

   if (notLoadedDeps.length !== 0) {
      throw new Error(`Can't find deps by identifiers: ${notLoadedDeps.join(',')}`);
   }

   return depends;
}

module.exports = new WasabyCLICommand()
    .name('createModule')
    .description('Создаёт модуль')
    .addOptions(options)
    .action(async({ params }, project) => {
       let config;

       switch (params.get('type')) {
          case 'test': {
             config = {
                type: 'test',
                environment: params.get('environment'),
                repository: {
                   name: 'createModule'
                }
             };

             break;
          }
          case 'demo': {
             config = {
                type: 'demo'
             };

             break;
          }
          default: {
             config = {
                type: 'ui'
             };
          }
       }

       config.kaizen = {
          id: params.get('kaizen'),
          responsible: params.get('responsible'),
          responsibleUuid: params.get('responsibleId')
       };
       config.path = params.get('path');
       config.name = pathUtils.basename(config.path);
       config.s3mod = pathUtils.join(config.path, config.name + '.s3mod');
       config.id = createGuid();
       config.forCDN = params.get('cdn');
       config.typescript = {
           typecheck: '1'
       };
       config.enableAutodoc = params.get('enableAutodoc');
       config.package = params.get('package');
       config.description = params.get('description');
       config.depends = await loadAndGetDeps(params.get('depends'), project);
       config.repository = project.repository;

       const module = Module.buildModuleFromObject(config);

       await module.save();

       const rootModules = project.getRootModules();

       project.store.modules.set(module.id, module);
       rootModules.set(module.id, module);

       await project.store.save(rootModules);
    });
