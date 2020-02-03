const path = require('path');

/**
 * Возвращает относительный путь от from до to, если отновительный путь построить не возможно вернет to
 * @param {String} from
 * @param {String} to
 */
function relative(from, to) {
   //для виндовых путей вида 'c:' 'd:' невозможно построить относительный путь, возвращаем просто to
   if (path.isAbsolute(from) && path.isAbsolute(to) && from[0] !== to[0]) {
      return to;
   }
   return path.normalize(path.relative(from, to));
}

module.exports = {
   relative: relative
};
