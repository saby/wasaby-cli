'use strict';

const {
    parseProcessArguments,
    getPathToCompiledFile,
    normalizeOptionValue
} = require('./common');

function redirectTestPath(root, args, modules) {
    if (args.runTestsByPath) {
        args.testPathPattern = getPathToCompiledFile(root, args.runTestsByPath, modules);

        delete args.runTestsByPath;
    }
}

function getWebStormArguments(argv, modules, root) {
    const args = parseProcessArguments(argv);

    normalizeOptionValue(args.options, 'reporters');

    redirectTestPath(root, args.options, modules);

    return args;
}

module.exports = getWebStormArguments;
module.exports.parseProcessArguments = parseProcessArguments;
module.exports.redirectTestPath = redirectTestPath;
