const GitHook = require('../src/GitHooks/GitHook');
const WasabyCLICommand = require('../src/Utils/WasbyCLIComand');

module.exports = new WasabyCLICommand()
    .name('initGitHooks')
    .description('Инициализирует локальные гит хуки от wasaby-cli. Доступно только, если wasaby-cli используется в репозитории.')
    .action(async(options, project) => {
       const repository = project.store.repositories.get(project.name);

       const hook = new GitHook('pre-commit', repository);

       await hook.init();
    });
