const { isAllowedToUse } = require('./options');

function prepareOptions(options) {
   const cliOptions = {
      ci: !options.get('updateSnapshot'),
      updateSnapshot: options.get('updateSnapshot')
   };

   for (const [name, value] of options) {
      if (cliOptions.hasOwnProperty(name)) {
         continue;
      }

      cliOptions[name] = value;
   }

   return cliOptions;
}

function getProcessArguments(options) {
   const args = { };
   const cliOptions = prepareOptions(options);

   for (const [name, value] of Object.entries(cliOptions)) {
      if (!isAllowedToUse(name)) {
         continue;
      }

      args[name] = value;
   }

   return args;
}

module.exports = getProcessArguments;
