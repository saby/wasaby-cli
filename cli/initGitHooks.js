const GitHook = require('../src/GitHooks/GitHook');
const WasabyCLICommand = require('../src/Utils/WasabyCLIComand');
const { Option } = require('commander');
const Repository = require('../src/Entities/Repository');

const options = [
   new Option(
      '--hookNames <hooksName...>',
      'Название хуков, которые инициализировать. По умолчанию устанавливается только pre-commit'
   )
      .choices(['pre-commit', 'pre-push'])
      .default(['pre-commit']),
];

module.exports = new WasabyCLICommand()
    .name('initGitHooks')
    .description('Инициализирует локальные гит хуки от wasaby-cli. Доступно только, если wasaby-cli используется в репозитории.')
    .addOptions(options)
    .action(async(options, project) => {
       const repository = project.store.repositories.get(project.name);

       if (repository instanceof Repository) {
          for (const typeHook of options.params.get('hookNames')) {
             const hook = new GitHook(typeHook, repository);

             await hook.init();
          }
       }
    });
