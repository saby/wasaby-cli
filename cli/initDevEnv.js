const open = require('open');

const DemoIndex = require('./../src/DemoIndex/DemoIndex');
const WasabyCLICommand = require('../src/Utils/WasbyCLIComand');

const loadProject = require('./loadProject');
const buildProject = require('./buildProject');
const initTSEnv = require('./initTSEnv');
const startServer = require('./startServer');

const options = [
   ...loadProject.options,
   ...buildProject.options,
   ...initTSEnv.options,
   ...startServer.options,
];

module.exports = new WasabyCLICommand()
    .name('initDevEnv')
    .description('Выполняет команды loadProject, buildProject, initTSEnv, запускает демо-стенд и открывает разводящую страницу.\n')
    .addOptions(options)
    .action(async(options, project) => {
       options.params.set('hotReload', true);

       await project.load();

       await project.initializeTSEnv();

       await project.build();

       const createIndex = new DemoIndex({
          options: options.params
       });

       await createIndex.create();

       await project.startServer();

       const onChangeCallback = async() => {
          await project.server.restart();
       };

       open(project.server.rootUrl);

       await project.runWatcher(onChangeCallback);
    });
