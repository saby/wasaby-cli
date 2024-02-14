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
   ['testEnvironmentOptions', true],
   ['setupFilesAfterEnv', true],
   ['testRunner', true],
   ['testSequencer', true],
   ['testResultsProcessor', true],

   // use only provided by wasaby-cli config file
   ['config', false],
   ['bail', true],
   ['cache', true],
   ['ci', true],
   ['colors', true],

   ['coverage', true],
   ['debug', true],
   ['expand', true],
   ['filter', true],

   // enabled by default
   ['forceExit', false],
   ['help', true],

   // should never be used
   ['init', false],
   ['notify', true],
   ['silent', true],

   ['noCache', true],
   ['clearCache', true],
   ['collectCoverageFrom', true],
   ['coverageDirectory', true],
   ['coverageReporters', true],
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
   ['testMatch', true],
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
   ['clearMocks', true],
   ['resetMocks', true],
   ['restoreMocks', true],
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

function getFullOptionName(rawName) {
   const camelName = kebab2camel(removeHyphens(rawName));

   if (JEST_OPTION_ALIASES.has(camelName)) {
      return JEST_OPTION_ALIASES.get(camelName);
   }

   return camelName;
}

function isAllowedToUse(rawName) {
   const fullOptionName = getFullOptionName(rawName);

   if (JEST_OPTIONS.has(fullOptionName)) {
      return JEST_OPTIONS.get(fullOptionName);
   }

   return false;
}

module.exports = {
   getFullOptionName,
   isAllowedToUse
};
