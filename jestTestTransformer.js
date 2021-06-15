const path = require('path');

function removeFileExtension(filePath) {
   return filePath.slice(0, filePath.lastIndexOf('.'));
}

function findUIModulePath(roots, fullPath) {
   for (let index = 0; index < roots.length; ++index) {
      const root = roots[index];
      if (!fullPath.startsWith(root)) {
         continue;
      }
      const startIndex = root.lastIndexOf(path.sep);
      return removeFileExtension(fullPath.slice(startIndex + 1));
   }
   return fullPath;
}

function prepareUIModulePath(config, fullPath) {
   const testModule = findUIModulePath(config.roots, fullPath);
   if (testModule) {
      return testModule;
   }
   const uiModule = findUIModulePath(config.moduleDirectories, fullPath);
   if (uiModule) {
      return uiModule;
   }
   return fullPath;
}

module.exports = {
   process(src, filename, config, options) {
      const uiModule = prepareUIModulePath(config, filename);
      return `${src};requirejs("${uiModule}");`;
   },
};
