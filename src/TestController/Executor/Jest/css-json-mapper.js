// маппер для .css.json файлов. В юнит-тестах мы должны отдавать оригинальные селекторы
// вместо хешей, чтобы снапшоты работали и были стабильные, хеши в юнит-тестах не нужны.
const idObj = new Proxy({}, {
   get: function getter(target, key) {
      if (key === '__esModule') {
         return false;
      }
      return key;
   }
});

module.exports = idObj;
