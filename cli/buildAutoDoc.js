const WasabyCLICommand = require('../src/Utils/WasabyCLIComand');
const {Option} = require('commander');

const options = [
    new Option('--rootReps <urls...>', 'Url-ы репозиториев, по всем модулям из них будет собрана документация.')
        .default([]),
    new Option(
        '--modules <moduleNames...>',
        'Имена модулей, по которым строить документацию.'
    )
        .default([]),
   new Option(
      '--dry',
      'Выполнить только валидацию данных для документации без записи результатов на диск.'
   )
      .default(false),
   new Option(
      '--logLevel <value>',
      'Минимальный уровень вывода диагностических сообщений в консоль.'
   )
      .choices([
         'critical',
         'error',
         'warning'
      ])
      .default('error'),
   new Option(
      '--cpuLimit <number>',
      'Максимальное количество ядер процессора, которое разрешено использовать инструментом.'
   ),
   new Option(
      '--colors [boolean]',
      'Управление цветом текста диагностических сообщений, выводимых в консоль.'
   )
      .default(true),
   new Option(
      '--noStandRebuild',
      'Не выполнять пересборку стенда, если он уже собран.'
   )
      .default(false),
   new Option(
      '--force',
      'Игнорировать ошибки сборки и не прерывать дальнейшие команды. Мы настоятельно не рекомендуем использовать данный флаг, игнорирование ошибок сборки может привести к ошибкам в дальнейших командах.'
   )
      .default(false),
   new Option(
      '--reporter <format>',
      'Выполнить генерацию отчета о выполнении команды в указанный формат.'
   )
      .choices([
         'text',
         'xml',
         'json'
      ])
];

module.exports = new WasabyCLICommand()
    .name('buildAutoDoc')
    .description('Команда соберёт автодокументацию по модулям репозитория, для отображения развернёт интерфейс, как на wi.sbis.ru.')
    .addOptions(options)
    .action(async(options, project) => {
       await project.buildAutoDoc();
    });
