/**
 * Команда сборки UI патча. Работает только для Туркменистана.
 * @author Кудрявцев И.С.
 */

const { Option } = require('commander');
const Config = require('../src/Utils/Config');
const pathUtils = require('../src/Utils/path');
const Zip = require('../src/Utils/Zip');
const WasabyCLICommand = require('../src/Utils/WasabyCLIComand');
const crypto = require('node:crypto');
const glob = require('glob');
const pMap = require('p-map');
const fs = require('fs-extra');

const commandOptions = [
   new Option(
      '--patchDir <path>',
      'Папка куда положить собранный патч.'
   )
      .default(pathUtils.join(process.cwd(), 'patches'))
      .argParser(Config.pathParser),
   new Option(
      '--prodModulesDir <path>',
      'Путь до папки где лежат собранные модули,по которым надо собрать патч.'
   ),
   new Option(
      '--patchConfig <Object>',
      'Конфиг билдера для патча'
   )
      .hideHelp(),
];

/**
 * Формирет имя для патча по дате.
 * @returns {String}
 */
function getPatchName() {
   return new Date().toISOString().split('.')[0].replace(/[-:]/g, '_')
}

module.exports = new WasabyCLICommand()
   .name('buildPatch')
   .description('Собирает патч по модулям в репозитории.')
   .addOptions(commandOptions)
   .action(async(options, project) => {
      const workDir = pathUtils.join(options.params.get('artifactsDir'), 'buildPatch');
      const moduleVersions = require(pathUtils.join(options.params.get('prodModulesDir'), 'revision.json'));
      const patchDir = pathUtils.join(workDir, 'patch');
      const rootModules = [];
      const deleteFiles = [];

      options.params.set('resources', pathUtils.join(workDir, 'resources'));
      options.params.set('buildPatch', true);
      options.params.set('builderCache', pathUtils.join(workDir, 'builderCache'));

      for (const module of project.getRootModules().values()) {
         const randomStr = crypto.randomBytes(20).toString('hex');

         rootModules.push(module.name);
         moduleVersions[module.name] = crypto.createHash('md5').update(randomStr).digest('hex');
      }

      options.params.set('moduleVersions', moduleVersions);

      // Собираем ресурсы для патча.
      await project.build();

      await fs.rm(patchDir, { force: true, recursive: true });
      await fs.ensureDir(options.params.get('patchDir'));

      // Вычисляем изменённые файлы и формируем структуру патча.
      await pMap(rootModules, async(name) => {
         const buildPath = pathUtils.join(options.params.get('resources'), name);
         const prodPath = pathUtils.join(options.params.get('prodModulesDir'), name);
         const newFiles = glob.sync(pathUtils.join(buildPath, '**/**.*'));
         const oldFiles = new Set(glob.sync(pathUtils.join(prodPath, '**/**.*')).map((filePath) => filePath.replace(prodPath, '')));

         await pMap(newFiles, async(filePath) => {
            const relPath = filePath.replace(buildPath, '');
            const patchPatch = pathUtils.join(patchDir, 'ui', 'resources', name, relPath);

            if ((await fs.lstat(filePath)).isDirectory()) {
               oldFiles.delete(relPath);

               return;
            }

            if (relPath.startsWith('/tsconfig.')) {
               return;
            }

            if (!oldFiles.has(relPath)) {
               await fs.copy(filePath, patchPatch);

               return;
            }

            const [newFile, oldFile] = await Promise.all([
               fs.readFile(filePath, 'utf8'),
               fs.readFile(pathUtils.join(prodPath, relPath), 'utf8'),
            ]);

            if (newFile !== oldFile) {
               await fs.copy(filePath, patchPatch);
            }

            oldFiles.delete(relPath);
         }, {
            concurrency: 30
         });

         for (const filePath of oldFiles) {
            deleteFiles.push(`ui/resources/${name}${filePath}`);
         }
      }, {
         concurrency: 2
      });

      if (deleteFiles.length !== 0) {
         await fs.outputFile(pathUtils.join(patchDir, 'deleted-files.txt'), deleteFiles.join('\n'));
      }

      await Zip.add(pathUtils.join(options.params.get('patchDir'), `p_${getPatchName()}`), patchDir);
   });