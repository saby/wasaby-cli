const nativePath = require('path');

function join() {
   return normalize(nativePath.join(...arguments));
}

function dirname(path) {
   return normalize(nativePath.dirname(path));
}

function basename(path, ext) {
   return nativePath.basename(path, ext);
}

function relative(base, path) {
   return normalize(nativePath.relative(base, path));
}

function isAbsolute(path) {
   return nativePath.isAbsolute(path);
}

function normalize(path) {
   return path.replace(/\\/g, '/');
}

module.exports = {
   join,
   dirname,
   relative,
   basename,
   isAbsolute,
   normalize
};
