const WasabyCLICommand = require('../src/Utils/WasabyCLIComand');
const {Option} = require('commander');

const options = [
    new Option('--rootReps <urls...>', 'Url-ы репозиториев, по всем модулям из них будет собрана документация')
        .default([]),
    new Option(
        '--modules <moduleNames...>',
        'Имена модулей, по которым строить документацию.'
    )
        .default([]),
   new Option(
      '--experimental-builder',
      'Использовать новый инструмент сборки автодокументации'
   )
      .default(false)
      .hideHelp(),
];

module.exports = new WasabyCLICommand()
    .name('buildAutoDoc')
    .description('Команда соберёт автодокументацию по модулям репозитории, для отображения развернёт интерфейс, как на wi.sbis.ru.')
    .addOptions(options)
    .action(async(options, project) => {
       await project.buildAutoDoc();
    });
