const SOURCE_MODULES = [/* #SOURCE_MODULES# */];
const BUILD_MODULES = [/* #BUILD_MODULES# */];

function resolvePath(src, dst, pathSnapshot) {
   const path = pathSnapshot.replace(/\\/gi, '/');

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
const testPathForConsistencyCheck = '/* #TEST_PATH_FOR_CONSISTENCY_CHECK# */';

module.exports = {
   resolveSnapshotPath: resolveSnapshotPath,
   resolveTestPath: resolveTestPath,
   testPathForConsistencyCheck: testPathForConsistencyCheck
};
