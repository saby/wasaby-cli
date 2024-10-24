const WasabyCLICommand = require('../src/Utils/WasbyCLIComand');
const {Option} = require('commander');

const options = [
   new Option(
       '--rep <repositoryNames...>',
       'Имена репозиториев. По их модулям строится документация.'
   )
       .default([]),
   new Option(
       '--modules <moduleNames...>',
       'Имена модулей, по которым строить документацию.'
   )
       .default([]),
];

module.exports = new WasabyCLICommand()
    .name('buildAutoDoc')
    .description('Команда соберёт автодокументацию по модулям репозитории, для отображения развернёт интерфейс, как на wi.sbis.ru.')
    .addOptions(options)
    .action(async(options, project) => {
       await project.buildAutoDoc();
    });
