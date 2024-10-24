const fs = require('fs-extra');

const pathUtils = require('../src/Utils/path');
const logger = require('../src/Utils/Logger');
const Store = require('../src/Store');
const ModulesMap = require('../src/Map/Modules');
const WasabyCLICommand = require('../src/Utils/WasbyCLIComand');

module.exports = new WasabyCLICommand()
    .name('updateMap')
    .description('Команда обновляет карту модулей в wasaby-cli')
    .hideHelp()
    .action(async(options) => {
       try {
          const store = new Store();

          store.modules = new ModulesMap();

          await store.addRepos(options.params.get('repositories').getRepositories().values());

          fs.outputFileSync(
              pathUtils.join(__dirname, '../resources/modulesMap.json'),
              JSON.stringify(store.modules.serialize(), null, 3)
          );
       } catch (err) {
          logger.error(err);
       }
    });

