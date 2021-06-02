const BUILD_DIRECTORY = '/*#BUILD_DIRECTORY#*/'; // ends with path separator
const SOURCE_DIRECTORY = '/*#SOURCE_DIRECTORY#*/'; // ends with path separator
const BUILD_MODULES = [/*#BUILD_MODULES#*/];

function isKnownModule(path) {
   for (let index = 0; index < BUILD_MODULES.length; ++index) {
      if (path.startsWith(BUILD_MODULES[index])) {
         return true;
      }
   }
   return false;
}

// Resolve snapshot file.
// Example:
//    Input:   dist/src/__test__/Post.spec.js
//    Output:  src/__test__/__snapshot__/Post.spec.ts.snap
// @param {string} testPath Test file path.
// @param {string} snapshotExtension Snapshot extension to be used (default is .snap)
function resolveSnapshotPath(testPath, snapshotExtension) {
   const defaultResult = testPath + snapshotExtension;
   if (!testPath.startsWith(BUILD_DIRECTORY)) {
      return defaultResult;
   }
   const restPath = testPath.slice(BUILD_DIRECTORY.length);
   if (!isKnownModule(restPath)) {
      return defaultResult;
   }
   return SOURCE_DIRECTORY + restPath + snapshotExtension;
}

// Resolve test file path.
// Example:
//    Input:   src/__test__/__snapshot__/Post.spec.ts.snap
//    Output:  dist/src/__test__/Post.spec.js
// @param {string} snapshotFilePath Snapshot file path.
// @param {string} snapshotExtension Snapshot extension to be used (default is .snap)
function resolveTestPath(snapshotFilePath, snapshotExtension) {
   const defaultResult = snapshotFilePath.slice(0, -snapshotExtension.length);
   if (!snapshotFilePath.startsWith(SOURCE_DIRECTORY)) {
      return defaultResult;
   }
   const restPath = snapshotFilePath.slice(SOURCE_DIRECTORY.length);
   if (!isKnownModule(restPath)) {
      return defaultResult;
   }
   return BUILD_DIRECTORY + restPath.slice(0, -snapshotExtension.length);
}

// resolveTestPath(resolveSnapshotPath(testPathForConsistencyCheck)) === testPathForConsistencyCheck
const testPathForConsistencyCheck = '/*#TEST_PATH_FOR_CONSISTENCY_CHECK#*/';

module.exports = {
   resolveSnapshotPath: resolveSnapshotPath,
   resolveTestPath: resolveTestPath,
   testPathForConsistencyCheck: testPathForConsistencyCheck
};
