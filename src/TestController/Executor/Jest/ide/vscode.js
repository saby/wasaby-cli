'use strict';

const {
    parseProcessArguments,
    getPathToCompiledFile,
    normalizeOptionValue
} = require('./common');

function redirectTestPath(root, args, modules) {
    if (args.runTestsByPath) {
        args.testPathPatterns = getPathToCompiledFile(root, args.runTestsByPath, modules);

        delete args.runTestsByPath;
    }
}

function getVSCodeArguments(argv, modules, root) {
    const args = parseProcessArguments(argv);

    normalizeOptionValue(args.options, 'reporters');

    redirectTestPath(root, args.options, modules);

    // vscode-jest передаёт --watchAll=false, чтобы явно отключить watch-режим.
    // В аргументы jest его передавать не нужно: jest и так запускается без watch,
    // а в виде двух аргументов "--watchAll false" он ломает матчинг тестов,
    // так как "false" интерпретируется как testPathPattern.
    if (args.options.watchAll === 'false') {
        delete args.options.watchAll;
    }

    return args;
}

module.exports = getVSCodeArguments;
module.exports.parseProcessArguments = parseProcessArguments;
module.exports.redirectTestPath = redirectTestPath;
