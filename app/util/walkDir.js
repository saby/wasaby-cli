const fs = require('fs-extra');
const path = require('path');

/**
 * Рекурсивно обходит дректории исключая симлинки
 * @param {String} rootDir - Директория которую надо обойти
 * @param {Function} callback - Коллбек, вызывается для файлов
 * @param {Array} exclude - Пути которые надо исключить
 * @function walkDir
 * @author Ганшин Я.О
 */
function walkDir(rootDir, callback, exclude, currentDir) {
   const defCurrentDir = currentDir || rootDir;
   const defExclude = exclude || [];
   const relativePath = path.relative(rootDir, defCurrentDir);
   if (fs.existsSync(defCurrentDir)) {
      fs.readdirSync(defCurrentDir).forEach((file) => {
         const fullPath = path.join(defCurrentDir, file);
         if (!defExclude.includes(fullPath) && !fs.lstatSync(fullPath).isSymbolicLink()) {
            if (fs.lstatSync(fullPath).isDirectory()) {
               walkDir(rootDir, callback, defExclude, fullPath);
            } else {
               callback(path.join(relativePath, file));
            }
         }
      });
   }
}

module.exports = walkDir;
