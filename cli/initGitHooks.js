const pathUtils = require('../src/Utils/path');

module.exports = async(options, project) => {
   const repository = project.store.repositories.get(project.name);

   await repository.setHookPath(pathUtils.join(__dirname, '../src/GitHooks'));
};
