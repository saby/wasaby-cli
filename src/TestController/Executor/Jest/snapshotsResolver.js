'use strict';

// Модуль генерации резолверса снимков для jest.
// Поскольку Jest запускается на директории application, то по умолчанию он будет писать снимки в эту же директорию,
// поэтому необходимо для каждого собранного файла определять местоположение его оригинала и писать снимки там,
// чтобы они попадали под контроль версий.
//
// Массив SOURCE_MODULES хранит абсолютные пути до оригиналов,
// массив BUILD_MODULES хранит абсолютные пути до модулей в директории application.

const pathUtils = require('../../../Utils/path');

const DEFAULT_UI_MODULE_NAME = 'DemoStand';
const COMPONENT_FOR_CONSISTENCY_CHECK = 'Component/index.js';

const generateSourceCode = (sourceModules, buildModules, testPathForConsistencyCheck) => (`
const SOURCE_MODULES = ${JSON.stringify(sourceModules)};
const BUILD_MODULES = ${JSON.stringify(buildModules)};

function resolvePath(src, dst, filePath) {
   const path = filePath.replace(/\\\\/gi, '/');

   for (let index = 0; index < src.length; ++index) {
      if (path.startsWith(src[index])) {
         return dst[index] + path.slice(src[index].length);
      }
   }

   return path;
}

// Resolve snapshot file.
// Example:
//    Input:   dist/src/__test__/Post.spec.js
//    Output:  src/__test__/__snapshot__/Post.spec.ts.snap
// @param {string} testPath Test file path.
// @param {string} snapshotExtension Snapshot extension to be used (default is .snap)
function resolveSnapshotPath(testPath, snapshotExtension) {
   return resolvePath(BUILD_MODULES, SOURCE_MODULES, testPath) + snapshotExtension;
}

// Resolve test file path.
// Example:
//    Input:   src/__test__/__snapshot__/Post.spec.ts.snap
//    Output:  dist/src/__test__/Post.spec.js
// @param {string} snapshotFilePath Snapshot file path.
// @param {string} snapshotExtension Snapshot extension to be used (default is .snap)
function resolveTestPath(snapshotFilePath, snapshotExtension) {
   return resolvePath(SOURCE_MODULES, BUILD_MODULES, snapshotFilePath).slice(0, -snapshotExtension.length);
}

// resolveTestPath(resolveSnapshotPath(testPathForConsistencyCheck)) === testPathForConsistencyCheck
const testPathForConsistencyCheck = ${JSON.stringify(testPathForConsistencyCheck)};

module.exports = {
   resolveSnapshotPath: resolveSnapshotPath,
   resolveTestPath: resolveTestPath,
   testPathForConsistencyCheck: testPathForConsistencyCheck
};
`);

function getTestPathForConsistencyCheck(config) {
   if (config.buildModules.length > 0) {
      // We have to use known path for test check
      return pathUtils.join(
         config.buildModules[0], COMPONENT_FOR_CONSISTENCY_CHECK
      );
   }

   return pathUtils.join(config.root, DEFAULT_UI_MODULE_NAME, COMPONENT_FOR_CONSISTENCY_CHECK);
}

function generateSnapshotResolverSource(resourcesRoot, modules) {
   const snapshotResolverConfig = {
      sourceModules: [],
      buildModules: [],
      root: resourcesRoot
   };

   for (const module of modules) {
      const buildPath = pathUtils.join(resourcesRoot, module.name);

      snapshotResolverConfig.sourceModules.push(module.path);
      snapshotResolverConfig.buildModules.push(buildPath);
   }

   const testPathForConsistencyCheck = getTestPathForConsistencyCheck(snapshotResolverConfig);

   return generateSourceCode(
      snapshotResolverConfig.sourceModules,
      snapshotResolverConfig.buildModules,
      testPathForConsistencyCheck
   );
}

module.exports = generateSnapshotResolverSource;
