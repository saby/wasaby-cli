/**
 * Подсистема запуска интеграционных тестов на Python
 */
const pathUtils = require('../Utils/path');
const Store = require('../ModuleManager/Store');
const Repository = require('../Entities/Repository');
const Python = require('../Process/Python');
const fs = require("fs-extra");
const pMap = require('p-map').default;

/**
 * Возвращает список Python-скриптов для установки окружения
 * @param venvPath {string} Путь до виртуального окружения Python
 * @param autotestsControlsBranch {string} Ветка репозитория autotests/controls
 * @returns Python[]
 */
function getInstallScripts(venvPath, autotestsControlsBranch){
   return [
      new Python({
         command: 'venv',
         envArgs: {
            m: true
         },
         params: [
            venvPath
         ],
         silent: true,
         assignmentOperator: ' '
      }),
      new Python({
         env: pathUtils.join(venvPath, 'Scripts', 'python'),
         exeFile: 'setup.py',
         params: [
            `install`,
            `--autotestsControls=${autotestsControlsBranch}`,
         ],
         silent: true,
         assignmentOperator: ' '
      })
   ];
}

/**
 * Класс подсистемы запуска интеграционных тестов на Python
 * @author Кудрявцев И.С.
 */
class IntegrationTest {
   /**
    * @param options {Object} Конфиг с опциями из консоли, package.json и т.п.
    * @param path {String} Путь к папке с подсистемой.
    */
   constructor(options, path) {
      this.path = path;
      this.options = options;
      this.revision = '';
      this.pathToTest = options.get('workDir');
      this.testPathPattern = options.get('testPathPattern');
      this.testNamePattern = options.get('testNamePattern');
      this.stand = options.get('port') ? `http://localhost:${options.get('port')}` : this.getRunningStand();
      this.storePath = pathUtils.join(this.path, 'store');
      this.store = new Store(this.storePath, options);

      const rootRep = new Repository({
         url: 'git@git.sbis.ru:autotests/instruments/autotests_utils.git',
         protocol: this.options.get('protocol'),
         requiredBranch: `rc-${this.options.get('cliVersion')}`,
         dir: this.storePath
      });
      this.rootRepName = rootRep.name;
      this.repositories = new Map([[
         this.rootRepName,
         rootRep
      ]]);
      this.venvPath = pathUtils.join(this.path, 'venv');
      this.venvPythonPath = pathUtils.join(this.venvPath, 'Scripts', 'python');
      this.installScripts = getInstallScripts(this.venvPath, options.get('rc'));
   }

   /**
    * Возвращает адрес стенда для тестирования
    * @returns string
    */
   getRunningStand() {
      let fileContents;
      try {
         fileContents = fs.readJsonSync(pathUtils.join(this.options.get('artifactsDir'), 'startServer/standInfo.json'));
      } catch (err) {
         if (err.code !== 'ENOENT') throw err;
         throw (
             'Для запуска интеграционных тестов необходимо, чтобы был запущен стенд. ' +
             'Либо укажите порт локального стенда через параметр --port'
         );
      }
      return fileContents['domain'];
   }

   /**
    * Загружает подсистему
    */
   async load() {
      await this.store.loadRepositories(this.repositories);
      this.workDir = this.repositories.get(this.rootRepName).path;
      this.revision = this.repositories.get(this.rootRepName).HEAD;
   }

   /**
    * Запускает тесты
    */
   async run() {
      const runScripts = [
         new Python({
            env: this.venvPythonPath,
            exeFile: 'setup.py',
            params: [
               `configure`,
               `--rootTestPath="${this.pathToTest}"`,
               `--stand="${this.stand}"`,
            ],
            assignmentOperator: ' ',
         }),
         new Python({
            env: this.venvPythonPath,
            exeFile: 'setup.py',
            params: [
               `test`,
               `--rootTestPath="${this.pathToTest}"`,
               this.testPathPattern ? `--testPathPattern="${this.testPathPattern}"`: '',
               this.testNamePattern ? `--testNamePattern="${this.testNamePattern}"`: '',
            ],
            assignmentOperator: ' ',
         })
      ];
      await pMap(runScripts, async (runScript) => {
         runScript.procOptions = {
            ...runScript.procOptions,
            cwd: this.workDir
         };
         await runScript.run();
      }, {
         concurrency: 1
      });
   }

   /**
    * Сериализация экземпляра подсистемы
    */
   serialize() {
      return {
         revision: this.revision,
         path: this.path,
         workDir: this.workDir
      }
   }
}

module.exports = IntegrationTest;