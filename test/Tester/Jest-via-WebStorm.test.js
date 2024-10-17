'use strict';

const {
    parseProcessArguments,
    redirectTestPath
} = require('../../src/TestController/Executor/Jest/ide/webstorm');

describe('Executing Jest via WebStorm', () => {
    describe('parseProcessArguments(argv)', () => {
        test('should parse --option=value', () => {
            const args = parseProcessArguments([
                '--noStackTrace',
                '--runTestsByPath=/path/to/file'
            ]);

            expect(args).toEqual({
               params: [],
               options: {
                  noStackTrace: true,
                  runTestsByPath: '/path/to/file'
               }
            });
        });
        test('should parse --option="value"', () => {
            const args = parseProcessArguments([
                '--noStackTrace',
                '--runTestsByPath="/path/to/file"'
            ]);

            expect(args).toEqual({
               params: [],
               options: {
                  noStackTrace: true,
                  runTestsByPath: '/path/to/file'
               }
            });
        });
        test('should parse option with value', () => {
            const args = parseProcessArguments([
                '--noStackTrace',
                '--runTestsByPath',
                '"/path/to/file"',
                '--showConfig'
            ]);

            expect(args).toEqual({
               params: [],
               options: {
                  noStackTrace: true,
                  runTestsByPath: '/path/to/file',
                  showConfig: true
               }
            });
        });
        test('should parse several options with the same name', () => {
            const args = parseProcessArguments([
                '--reporters',
                'default',
                '--reporters',
                '/path/to/reporter',
                '/path/to/file'
            ]);

            expect(args).toEqual({
               params: [
                  '/path/to/file'
               ],
               options: {
                  reporters: [
                     'default',
                     '/path/to/reporter'
                  ]
               }
            });
        });
    });
    describe('redirectTestPath(root, args, modules)', () => {
        describe('win32', () => {
            const root = 'f:/app';
            const modules = new Set([
                { name: 'First', path: 'C:/repository/First' },
                { name: 'Second', path: 'd:/repository/Second' },
                { name: 'Third', path: 'E:\\repository\\Third' }
            ]);

            test('should replace file path and extension', () => {
                const args = {
                    runTestsByPath: 'd:/repository/Second/dir/file.test.tsx'
                };

                redirectTestPath(root, args, modules);

                expect(args.runTestsByPath).toBeUndefined();
                expect(args.testPathPattern).toEqual('F:/app/Second/dir/file.test.js');
            });

            test('should not replace file path and extension', () => {
                const args = {
                    runTestsByPath: 'd:/repository/Fourth/dir/file.test.tsx'
                };

                redirectTestPath(root, args, modules);

                expect(args.runTestsByPath).toBeUndefined();
                expect(args.testPathPattern).toEqual('D:/repository/Fourth/dir/file.test.tsx');
            });
        });
        describe('posix', () => {
            const root = '/home/user/app';
            const modules = new Set([
                { name: 'First', path: '/home/user/repository/First' },
                { name: 'Second', path: '/home/user/repository/Second' },
                { name: 'Third', path: '/home/user/repository/Third' }
            ]);

            test('should replace file path and extension', () => {
                const args = {
                    runTestsByPath: '/home/user/repository/Second/dir/file.test.tsx'
                };

                redirectTestPath(root, args, modules);

                expect(args.runTestsByPath).toBeUndefined();
                expect(args.testPathPattern).toEqual('/home/user/app/Second/dir/file.test.js');
            });

            test('should not replace file path and extension', () => {
                const args = {
                    runTestsByPath: '/home/user/repository/Fourth/dir/file.test.tsx'
                };

                redirectTestPath(root, args, modules);

                expect(args.runTestsByPath).toBeUndefined();
                expect(args.testPathPattern).toEqual('/home/user/repository/Fourth/dir/file.test.tsx');
            });
        });
    });
});
