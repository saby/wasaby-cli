'use strict';

const { isAllowedToUse } = require('../options');

const { normalize, join } = require('../../../../Utils/path');

function toUpperCase(filePath) {
    if (filePath.match(/\w:\//)) {
        return filePath.at(0).toUpperCase() + filePath.slice(1);
    }

    return filePath;
}

function normalizePath(filePath) {
    return toUpperCase(normalize(filePath))
}

function removeQuotes(string) {
    return string
        .replace(/^['"]/, '')
        .replace(/['"]$/, '');
}

function parseProcessArguments(argv) {
    const args = { };
    let lastOption;
    let index = 0;

    const putArgument = (name, value) => {
        if (args.hasOwnProperty(name)) {
            if (!Array.isArray(args[name])) {
                args[name] = [args[name]];
            }

            args[name].push(value);
            return;
        }

        args[name] = value;
    };
    const flushArgument = (withValue) => {
        if (lastOption) {
            // Сбросим предыдущую опцию, если она есть
            if (isAllowedToUse(lastOption)) {
                putArgument(lastOption, withValue);
            }
            lastOption = undefined;

            return true;
        }

        return false;
    };

    for (const argument of argv) {
        const [name, value] = argument.split('=');
        const cleanName = name.replace(/^--/, '');

        if (value) {
            // Получено --option=value
            flushArgument(true);

            if (isAllowedToUse(cleanName)) {
                putArgument(cleanName, removeQuotes(value));
            }

            continue;
        }

        if (name.startsWith('--')) {
            // Получено --option, следующим аргументом может быть значение
            flushArgument(true);

            lastOption = cleanName;
            continue;
        }

        if (lastOption) {
            // Получили значение предыдущей опции
            flushArgument(removeQuotes(argument));

            continue;
        }

        // Получили аргумент
        args[`opt#${index++}`] = removeQuotes(argument);
    }

    // Сбросим предыдущую опцию, если она есть
    flushArgument(true);

    return args;
}

function getPathToCompiledFile(root, testPath, modules) {
    const rootPath = normalizePath(root);
    let testPathPattern = normalizePath(testPath);

    if (testPath) {
        for (const module of modules) {
            const modulePath = normalizePath(module.path);

            if (testPathPattern.startsWith(modulePath)) {
                testPathPattern = testPathPattern
                    .replace(modulePath, join(rootPath, module.name))
                    .replace(/\.tsx?$/, '.js');
            }
        }
    }

    return testPathPattern;
}

function modifyOptionValue(args, name, fn) {
    if (args[name]) {
        if (Array.isArray(args[name])) {
            args[name] = args[name].map(p => fn(p));

            return;
        }

        args[name] = fn(args[name]);
    }
}

function normalizeOptionValue(args, name) {
    modifyOptionValue(args, name, normalizePath);
}

module.exports = {
    parseProcessArguments,
    getPathToCompiledFile,
    normalizeOptionValue
};
