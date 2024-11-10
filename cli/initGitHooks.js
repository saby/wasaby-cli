const GitHook = require('../src/GitHooks/GitHook');

module.exports = async(options, project) => {
   const repository = project.store.repositories.get(project.name);

   const hook = new GitHook('pre-commit', repository);

   await hook.init();
};
