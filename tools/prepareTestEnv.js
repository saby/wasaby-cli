const isolated = require('saby-units/lib/isolated.js');

isolated.prepareTestEnvironment('application', undefined, false, undefined, false);

let counter = 1;
global.define = function(name, deps, callback) {
   if (typeof name !== 'string') {
      callback = deps;
      deps = name;
      name = 'module_' + ++counter;
   }
   requirejs.define(name, deps, callback);
   if (name.includes('module_') || name.includes('.test')) {
      requirejs(name);
   }
};
