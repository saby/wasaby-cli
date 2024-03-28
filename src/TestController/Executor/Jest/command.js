const { isAllowedToUse, getFullOptionName } = require('./options');

// Набор опций, которые запрещены для использования через cli.
// (но разрешены для использования через ide).
// TODO: подумать над лучшей организацией этих опций.
const FORBIDDEN_CLI_OPTIONS = new Set([
    'coverage'
]);

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

      if (FORBIDDEN_CLI_OPTIONS.has(getFullOptionName(name))) {
         continue;
      }

      args[name] = value;
   }

   return args;
}

module.exports = getProcessArguments;
