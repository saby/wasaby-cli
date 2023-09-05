'use strict';

const JEST_OPTION_ALIASES = new Map([
   ['c', 'config'],
   ['b', 'bail'],
   ['e', 'expand'],
   ['w', 'maxWorkers'],
   ['i', 'runInBand'],
   ['t', 'onlyChanged'],
   ['u', 'updateSnapshot'],
]);

const JEST_OPTIONS = new Map([
   ['env', true],
   ['json', true],
   ['projects', true],
   ['reporters', true],
   ['roots', true],

   ['coverageProvider', true],
   ['injectGlobals', true],
   ['outputFile', true],
   ['setupTestFrameworkScriptFile', true],
   ['testRunner', true],
   ['testSequencer', true],
   ['testResultsProcessor', true],

   // use only provided by wasaby-cli config file
   ['config', false],
   ['bail', true],
   ['cache', true],
   ['ci', true],
   ['colors', true],

   // Provide this option only through config file
   ['coverage', false],
   ['debug', true],
   ['expand', true],
   ['filter', true],

   // enabled by default
   ['forceExit', false],
   ['help', true],
   ['init', true],
   ['notify', true],
   ['silent', true],

   ['noCache', true],
   ['clearCache', true],
   ['collectCoverageFrom', true],
   ['changedFilesWithAncestor', true],
   ['changedSince', true],
   ['detectOpenHandles', true],
   ['errorOnDeprecated', true],
   ['findRelatedTests', true],
   ['lastCommit', true],
   ['listTests', true],

   // enabled by default
   ['logHeapUsage', false],
   ['maxConcurrency', true],
   ['maxWorkers', true],
   ['noStackTrace', true],
   ['onlyChanged', true],
   ['passWithNoTests', true],
   ['runInBand', true],
   ['selectProjects', true],
   ['runTestsByPath', true],
   ['showConfig', true],
   ['testNamePattern', true],
   ['testLocationInResults', true],
   ['testPathPattern', true],
   ['testPathIgnorePatterns', true],
   ['testTimeout', true],
   ['updateSnapshot', true],
   ['useStderr', true],
   ['verbose', true],
   ['version', true],
   ['watch', true],
   ['watchAll', true],
   ['watchman', true],
   ['noWatchman', true],
]);

function removeHyphens(name) {
   if (name.startsWith('--')) {
      return name.slice(2);
   }
   if (name.startsWith('-')) {
      return name.slice(1);
   }
   return name;
}

function kebab2camel(text) {
   let item;
   const regex = /\-([a-z])/g;
   while (item = regex.exec(text)) {
      text = text.replace(item[0], item[1].toUpperCase());
   }
   return text;
}

function isAllowedToUse(rawName) {
   const camelName = kebab2camel(removeHyphens(rawName));
   const longName = JEST_OPTION_ALIASES.has(camelName) ? JEST_OPTION_ALIASES.get(camelName) : camelName;
   if (JEST_OPTIONS.has(longName)) {
      return JEST_OPTIONS.get(longName);
   }
   return false;
}

module.exports = {
   isAllowedToUse
};
