const Repository = require('../../src/Entities/Repository');
const Git = require('../../src/Utils/Git');
const tensorFlow = require('../../src/Utils/tensorFlow');
const Module = require('../../src/Module/Module');
const ChildProcess = require('../../src/Process/ChildProcess');

const fs = require('fs-extra');

jest.mock('../../src/Utils/Logger', () => ({
   error: () => {},
   debug: () => {},
   info: () => {},
   writeFile: () => Promise.resolve(),
   dir: 'src/logs'
}));

jest.mock('../../src/Process/ChildProcess', () => {
   return jest.fn().mockImplementation(() => {
      return {
         run: jest.fn().mockImplementation(() => Promise.resolve())
      };
   });
});

const defaultOptions = {
   name: 'Rep',
   dir: 'src/dir',
   path: 'src/dir/Rep'
};

describe('Repository', () => {
   describe('constructor()', () => {
      const defaultRep = {
         HEAD: undefined,
         requiredBranch: undefined,
         requireLoading: false,
         initialized: false,
         modulesDir: 'src/dir/Rep'
      };

      function expectRepositoryOptions(rep, expected = {}) {
         const standard = { ...defaultRep, ...expected };

         expect(rep.HEAD).toStrictEqual(standard.HEAD);
         expect(rep.requiredBranch).toStrictEqual(standard.requiredBranch);
         expect(rep.requireLoading).toStrictEqual(standard.requireLoading);
         expect(rep.initialized).toStrictEqual(standard.initialized);
         expect(rep.modulesDir).toStrictEqual(standard.modulesDir);
      }

      test('should create default instance', () => {
         const repository = new Repository(defaultOptions);

         expectRepositoryOptions(repository);
      });

      test('should create instance for sbis/core', () => {
         const repository = new Repository({
            ...defaultOptions,
            name: 'sbis_core',
            path: 'src/dir/sbis_core'
         });

         expectRepositoryOptions(repository, {
            modulesDir: 'src/dir/sbis_core/client'
         });
      });

      test('should create instance with requiredBranch', () => {
         const repository = new Repository({
            ...defaultOptions,
            requiredBranch: 'myBranch'
         });

         expectRepositoryOptions(repository, {
            requiredBranch: 'myBranch'
         });
      });

      test('should create instance with requireLoading', () => {
         const repository = new Repository({
            ...defaultOptions,
            requireLoading: true
         });

         expectRepositoryOptions(repository, {
            requireLoading: true
         });
      });

      test('should create instance with initialized', () => {
         const repository = new Repository({
            ...defaultOptions,
            initialized: true
         });

         expectRepositoryOptions(repository, {
            initialized: true
         });
      });
   });

   describe('init()', () => {
      let stubPathExistsSync;
      let stubClone;
      let stubUpdate;
      let repository;

      beforeEach(() => {
         repository = new Repository(defaultOptions);

         stubPathExistsSync = jest.spyOn(fs, 'pathExistsSync').mockImplementation(() => true);
         stubClone = jest.spyOn(repository, 'clone').mockImplementation(() => Promise.resolve());
         stubUpdate = jest.spyOn(repository, 'update').mockImplementation(() => Promise.resolve());
      });

      afterEach(() => {
         stubPathExistsSync.mockRestore();
         stubClone.mockRestore();
         stubUpdate.mockRestore();
      });

      test('not should update if repository initialized', async() => {
         repository.initialized = true;

         await repository.init();

         expect(stubClone.mock.calls.length).toStrictEqual(0);
         expect(stubUpdate.mock.calls.length).toStrictEqual(0);
      });

      test('should update if repository cloned', async() => {
         await repository.init();

         expect(stubClone.mock.calls.length).toStrictEqual(0);
         expect(stubUpdate.mock.calls.length).toStrictEqual(1);
         expect(repository.initialized).toBeTruthy();
      });

      test('should clone if repository not clone', async() => {
         stubPathExistsSync.mockImplementation(() => false);

         await repository.init();

         expect(stubClone.mock.calls.length).toStrictEqual(1);
         expect(stubUpdate.mock.calls.length).toStrictEqual(0);
         expect(repository.initialized).toBeTruthy();
      });
   });

   describe('isExcludedDir()', () => {
      let stubPathExistsSync;
      let stubLstatSync;
      let stubStat;
      let repository;

      beforeEach(() => {
         repository = new Repository(defaultOptions);

         stubPathExistsSync = jest.spyOn(fs, 'pathExistsSync').mockImplementation(path => path === 'src/meta/metaInfo.json' || path === 'src/store/store.json');

         stubStat = {
            isDirectory: jest.fn(() => true)
         };
         stubLstatSync = jest.spyOn(fs, 'lstatSync').mockImplementation(() => stubStat);
      });

      afterEach(() => {
         stubPathExistsSync.mockRestore();
         stubLstatSync.mockRestore();
      });

      test('should return true if it is not directory', () => {
         stubStat.isDirectory.mockImplementation(() => false);

         expect(repository.isExcludedDir('src/file.sss')).toBeTruthy();
      });

      test('should return true if it is build directory', () => {
         expect(repository.isExcludedDir('src/meta')).toBeTruthy();
      });

      test('should return true if it is source store directory', () => {
         expect(repository.isExcludedDir('src/store')).toBeTruthy();
      });

      test('should return false if it is usual directory', () => {
         expect(repository.isExcludedDir('src/goodDir')).toBeFalsy();
      });
   });

   describe('findModules()', () => {
      let stubReadDir;
      let stubIsExcludeDir;
      let stubPathExistsSync;
      let repository;

      beforeEach(() => {
         repository = new Repository(defaultOptions);

         stubReadDir = jest.spyOn(fs, 'readdir').mockImplementation((path) => {
            if (path === 'src/BlackList') {
               return Promise.resolve([
                  'node_modules',
                  '_repos',
                  'application',
                  'build-ui'
               ]);
            }

            if (path === 'src/serviceDir') {
               return Promise.resolve(['.git']);
            }

            if (path === 'src') {
               return Promise.resolve(['module1']);
            }

            if (path === 'src/dir') {
               return Promise.resolve(['dir']);
            }

            if (path === 'src/dir/dir') {
               return Promise.resolve(['module2']);
            }
         });
         stubIsExcludeDir = jest.spyOn(repository, 'isExcludedDir').mockImplementation(() => false);
         stubPathExistsSync = jest.spyOn(fs, 'pathExistsSync').mockImplementation(path => path === 'src/module1/module1.s3mod' || path === 'src/dir/dir/module2/module2.s3mod');
      });

      afterEach(() => {
         stubReadDir.mockRestore();
         stubIsExcludeDir.mockRestore();
         stubPathExistsSync.mockRestore();
      });

      test('should exclude all directory from black list', async() => {
         const result = new Set();
         await repository.findModules('src/BlackList', result);

         expect(result.size).toStrictEqual(0);
         expect(stubPathExistsSync.mock.calls.length).toStrictEqual(0);
         expect(stubIsExcludeDir.mock.calls.length).toStrictEqual(0);
      });

      test('should exclude service directory', async() => {
         const result = new Set();
         await repository.findModules('src/serviceDir', result);

         expect(result.size).toStrictEqual(0);
         expect(stubPathExistsSync.mock.calls.length).toStrictEqual(0);
         expect(stubIsExcludeDir.mock.calls.length).toStrictEqual(0);
      });

      test('should exclude file and generate directory', async() => {
         stubIsExcludeDir.mockImplementation(() => true);

         const result = new Set();
         await repository.findModules('src/dir', result);

         expect(result.size).toStrictEqual(0);
         expect(stubPathExistsSync.mock.calls.length).toStrictEqual(0);
         expect(stubIsExcludeDir.mock.calls.length).toStrictEqual(1);
      });

      test('should find one module', async() => {
         const result = new Set();
         await repository.findModules('src', result);

         expect(result.size).toStrictEqual(1);
         expect([...result]).toEqual(['src/module1/module1.s3mod']);
      });

      test('should find modules recursive', async() => {
         const result = new Set();
         await repository.findModules('src/dir', result);

         expect(result.size).toStrictEqual(1);
         expect([...result]).toEqual(['src/dir/dir/module2/module2.s3mod']);
      });
   });

   describe('getModules()', () => {
      let stubFindModule;
      let stubModuleFromXml;
      let repository;

      beforeEach(() => {
         repository = new Repository(defaultOptions);

         stubFindModule = jest.spyOn(repository, 'findModules').mockImplementation(async(dir, modules) => {
            modules.add('src/rep/Module1/Module1.s3mod');
         });
         stubModuleFromXml = jest.spyOn(Module, 'buildModuleFromXml').mockImplementation((path) => {
            if (path === 'src/rep/Module1/Module1.s3mod') {
               return Promise.resolve({
                  type: 'ui',
                  name: 'Module1'
               });
            }
         });
      });

      afterEach(() => {
         stubFindModule.mockRestore();
         stubModuleFromXml.mockRestore();
      });

      test('should return all modules', async() => {
         const testedResult = await repository.getModules();

         expect(testedResult.all.size).toStrictEqual(1);
         expect(testedResult.has('Module1')).toBeTruthy();
      });

      test('should detect modules only first call', async() => {
         await repository.getModules();
         await repository.getModules();

         expect(stubFindModule.mock.calls.length).toStrictEqual(1);
      });
   });

   describe('detectCheckoutStrategy()', () => {
      let stubIsBranch;
      let stubIsRcBranch;
      let stubGetNearestRcBranch;
      let stubGetRcBranch;
      let stubRevParse;
      let stubCheckout;
      let stubBranch;
      let repository;

      beforeEach(() => {
         repository = new Repository(defaultOptions);
         repository.requiredBranch = '22.1000';

         stubRevParse = jest.spyOn(repository, 'revParse').mockReturnValue(Promise.resolve('22.1000/branch'));
         stubCheckout = jest.spyOn(repository, 'checkout').mockReturnValue(Promise.resolve());
         stubBranch = jest.spyOn(repository, 'branch').mockReturnValue(Promise.resolve());

         stubIsBranch = jest.spyOn(Git, 'isBranch').mockReturnValue(true);

         stubIsRcBranch = jest.spyOn(tensorFlow, 'isRcBranch').mockReturnValue(false);
         stubGetNearestRcBranch = jest.spyOn(tensorFlow, 'getNearestRcBranch').mockImplementation(() => Promise.resolve('rc-22.1000'));
         stubGetRcBranch = jest.spyOn(tensorFlow, 'getRcBranch').mockReturnValue('rc-22.1000');
      });

      afterEach(() => {
         stubIsBranch.mockRestore();
         stubIsRcBranch.mockRestore();
         stubGetNearestRcBranch.mockRestore();
         stubGetRcBranch.mockRestore();
         stubRevParse.mockRestore();
         stubCheckout.mockRestore();
      });

      test('should return strategy all commands are disable if state of commits is freeze', async() => {
         repository.freezeStateOfCommits = true;

         expect(await repository.detectCheckoutStrategy()).toEqual({
            checkout: false,
            merge: false,
            pullAfterCheckout: false,
            pullBeforeCheckout: false
         });
      });

      test('should return strategy with only checkout if required branch is not branch', async() => {
         stubIsBranch.mockReturnValue(false);
         repository.requiredBranch = '1234sd1234';

         expect(await repository.detectCheckoutStrategy()).toEqual({
            checkout: '1234sd1234',
            merge: false,
            pullAfterCheckout: false,
            pullBeforeCheckout: false
         });
      });

      test('should return strategy with checkout and pull after if branch is rc', async() => {
         stubIsRcBranch.mockReturnValue(true);

         expect(await repository.detectCheckoutStrategy()).toEqual({
            checkout: 'rc-22.1000',
            merge: false,
            pullAfterCheckout: true,
            pullBeforeCheckout: false
         });
      });

      test('should delete branch and return strategy with checkout and merge if branch is not rc', async() => {
         repository.requiredBranch = '22.1000/myBranch';

         expect(await repository.detectCheckoutStrategy()).toEqual({
            checkout: '22.1000/myBranch',
            merge: 'rc-22.1000',
            pullAfterCheckout: false,
            pullBeforeCheckout: false
         });

         expect(stubBranch.mock.calls.length).toStrictEqual(1);
         expect(stubBranch.mock.calls[0][0]).toStrictEqual('22.1000/myBranch');
         expect(stubBranch.mock.calls[0][1]).toEqual({ D: true });
      });

      test('should checkout rc if current branch is required', async() => {
         repository.requiredBranch = '22.1000/branch';

         expect(await repository.detectCheckoutStrategy()).toEqual({
            checkout: '22.1000/branch',
            merge: 'rc-22.1000',
            pullAfterCheckout: false,
            pullBeforeCheckout: true
         });

         expect(stubCheckout.mock.calls.length).toStrictEqual(1);
         expect(stubCheckout.mock.calls[0][0]).toStrictEqual('rc-22.1000');
         expect(stubCheckout.mock.calls[0][1]).toEqual({ force: true });
      });

      test('should checkout rc if current branch is hash commit', async() => {
         repository.requiredBranch = '22.1000/branch';
         stubRevParse.mockReturnValue('HEAD');

         expect(await repository.detectCheckoutStrategy()).toEqual({
            pullAfterCheckout: false,
            pullBeforeCheckout: true,
            checkout: '22.1000/branch',
            merge: 'rc-22.1000'
         });

         expect(stubCheckout.mock.calls.length).toStrictEqual(1);
         expect(stubCheckout.mock.calls[0][0]).toStrictEqual('rc-22.1000');
         expect(stubCheckout.mock.calls[0][1]).toEqual({force: true});
      });

      test('should return merge with branch is given to users', async() => {
         repository.requiredBranch = '22.1000/myBranch:mergeBranch';

         expect(await repository.detectCheckoutStrategy()).toEqual({
            checkout: '22.1000/myBranch',
            merge: 'mergeBranch',
            pullAfterCheckout: false,
            pullBeforeCheckout: false
         });
      });

      test('not should return exception if could not delete branch', async() => {
         stubBranch.mockImplementation(() => {
            throw 'git not exists';
         });

         expect.assertions(0);

         try {
            await repository.detectCheckoutStrategy();
         } catch (err) {
            expect(err).not.toBeUndefined();
         }
      });
   });

   describe('checkoutByStrategy()', () => {
      let stubPull;
      let stubCheckout;
      let stubMerge;
      let repository;

      beforeEach(() => {
         repository = new Repository(defaultOptions);

         stubPull = jest.spyOn(repository, 'pull').mockReturnValue(Promise.resolve());
         stubCheckout = jest.spyOn(repository, 'checkout').mockReturnValue(Promise.resolve());
         stubMerge = jest.spyOn(repository, 'merge').mockReturnValue(Promise.resolve());
      });

      afterEach(() => {
         stubPull.mockRestore();
         stubCheckout.mockRestore();
         stubMerge.mockRestore();
      });

      test('should pull repository before checkout', async() => {
         await repository.checkoutByStrategy({
            pullBeforeCheckout: true,
            checkout: false,
            pullAfterCheckout: false,
            merge: false
         });

         expect(stubPull.mock.calls.length).toStrictEqual(1);
      });

      test('should checkout to branch', async() => {
         await repository.checkoutByStrategy({
            pullBeforeCheckout: false,
            checkout: 'branch',
            pullAfterCheckout: false,
            merge: false
         });

         expect(stubCheckout.mock.calls.length).toStrictEqual(1);
         expect(stubCheckout.mock.calls[0][0]).toStrictEqual('branch');
         expect(stubCheckout.mock.calls[0][1]).toEqual({ force: true });
      });

      test('should pull after checkout', async() => {
         await repository.checkoutByStrategy({
            pullBeforeCheckout: false,
            checkout: 'branch',
            pullAfterCheckout: true,
            merge: false
         });

         expect(stubPull.mock.calls.length).toStrictEqual(1);
      });

      test('should merge to current branch', async() => {
         await repository.checkoutByStrategy({
            pullBeforeCheckout: false,
            checkout: false,
            pullAfterCheckout: false,
            merge: 'mergeBranch'
         });

         expect(stubMerge.mock.calls.length).toStrictEqual(1);
         expect(stubMerge.mock.calls[0][0]).toStrictEqual('mergeBranch');
      });

      test('should run all commands', async() => {
         await repository.checkoutByStrategy({
            pullBeforeCheckout: true,
            checkout: 'branch',
            pullAfterCheckout: true,
            merge: 'mergeBranch'
         });

         expect(stubPull.mock.calls.length).toStrictEqual(2);

         expect(stubCheckout.mock.calls.length).toStrictEqual(1);
         expect(stubCheckout.mock.calls[0][0]).toStrictEqual('branch');
         expect(stubCheckout.mock.calls[0][1]).toEqual({ force: true });

         expect(stubMerge.mock.calls.length).toStrictEqual(1);
         expect(stubMerge.mock.calls[0][0]).toStrictEqual('mergeBranch');
      });
   });

   describe('delete()', () => {
      let repository;

      beforeEach(() => {
         repository = new Repository(defaultOptions);
         ChildProcess.mockClear();
      });

      test('should delete repository on window platform', async() => {
         await repository.delete('win32');

         expect(ChildProcess.mock.calls.length).toStrictEqual(2);
         expect(ChildProcess.mock.calls[0][0]).toEqual({
            commandLine: 'DEL /F/Q/S Rep > NUL',
            procOptions: {
               cwd: 'src/dir'
            },
            processName: 'Rep delete'
         });

         expect(ChildProcess.mock.calls[1][0]).toEqual({
            commandLine: 'RMDIR /Q/S Rep',
            procOptions: {
               cwd: 'src/dir'
            },
            processName: 'Rep delete'
         });
      });

      test('should delete repository on linux platform', async() => {
         await repository.delete('linux');

         expect(ChildProcess.mock.calls.length).toStrictEqual(1);
         expect(ChildProcess.mock.calls[0][0]).toEqual({
            commandLine:  'rm -rf Rep',
            procOptions: {
               cwd: 'src/dir'
            },
            processName: 'Rep delete'
         });
      });
   });

   describe('update()', () => {
      let stubReset;
      let stubClean;
      let stubFetch;
      let stubDelete;
      let stubClone;
      let repository;

      beforeEach(() => {
         repository = new Repository(defaultOptions);

         stubReset = jest.spyOn(repository, 'reset').mockReturnValue(Promise.resolve());
         stubClean = jest.spyOn(repository, 'clean').mockReturnValue(Promise.resolve());
         stubFetch = jest.spyOn(repository, 'fetch').mockReturnValue(Promise.resolve());
         stubDelete = jest.spyOn(repository, 'delete').mockReturnValue(Promise.resolve());
         stubClone = jest.spyOn(repository, 'clone').mockReturnValue(Promise.resolve());
      });

      afterEach(() => {
         stubReset.mockRestore();
         stubClean.mockRestore();
         stubFetch.mockRestore();
         stubDelete.mockRestore();
         stubClone.mockRestore();
      });

      test('should reset, clean and fetch repository', async() => {
         await repository.update();

         expect(stubReset.mock.calls.length).toStrictEqual(1);
         expect(stubReset.mock.calls[0][0]).toEqual({ hard: true });

         expect(stubClean.mock.calls.length).toStrictEqual(1);
         expect(stubClean.mock.calls[0][0]).toStrictEqual({
            force: true,
            d: true,
            x: true
         });

         expect(stubFetch.mock.calls.length).toStrictEqual(1);
         expect(stubFetch.mock.calls[0][0]).toStrictEqual({
            all: true,
            prune: true
         });
      });

      test('should delete and clone repository if could not fetch', async() => {
         stubFetch.mockImplementation(() => {
            throw 'error fetch';
         });

         await repository.update();

         expect(stubDelete.mock.calls.length).toStrictEqual(1);
         expect(stubDelete.mock.calls[0][0]).toStrictEqual(process.platform);

         expect(stubClone.mock.calls.length).toStrictEqual(1);
      });
   });

   describe('getChangedFiles()', () => {
      let stubDiff;
      let repository;

      beforeEach(() => {
         repository = new Repository(defaultOptions);

         stubDiff = jest.spyOn(repository, 'diff').mockReturnValue([]);
      });

      afterEach(() => {
         stubDiff.mockRestore();
      });

      test('should return empty list if there are no changed files', async() => {
         expect(await repository.getChangedFiles('rev')).toEqual({
            changed: [],
            deleted: []
         });
      });

      test('should call git diff with only name and status between revision and HEAD', async() => {
         await repository.getChangedFiles('rev');

         expect(stubDiff.mock.calls.length).toStrictEqual(1);
         expect(stubDiff.mock.calls[0][0]).toStrictEqual('"rev"');
         expect(stubDiff.mock.calls[0][1]).toStrictEqual('HEAD');
         expect(stubDiff.mock.calls[0][2]).toStrictEqual({ 'name-status': true });
      });

      test('should mark old path deleted but new path changed if file was renamed and moved', async() => {
         stubDiff.mockReturnValue([
            'R12\tModule1/file\tModule2/file',
            'R\tModule/file\tModule/newfile'
         ]);

         expect(await repository.getChangedFiles('rev')).toEqual({
            changed: [
               'src/dir/Rep/Module2/file',
               'src/dir/Rep/Module/newfile'
            ],
            deleted: [
               'src/dir/Rep/Module1/file',
               'src/dir/Rep/Module/file'
            ]
         });
      });

      test('should mark path deleted if file was deleted', async() => {
         stubDiff.mockReturnValue([
            'D\tModule1/file',
            'D\tModule/file'
         ]);

         expect(await repository.getChangedFiles('rev')).toEqual({
            changed: [],
            deleted: [
               'src/dir/Rep/Module1/file',
               'src/dir/Rep/Module/file'
            ]
         });
      });

      test('should mark path changed if file not was renamed, moved, deleted', async() => {
         stubDiff.mockReturnValue([
            'A\tModule1/file',
            'A\tModule/file'
         ]);

         expect(await repository.getChangedFiles('rev')).toEqual({
            changed: [
               'src/dir/Rep/Module1/file',
               'src/dir/Rep/Module/file'
            ],
            deleted: []
         });
      });
   });

   describe('isCDN()', () => {
      test('should return true if name ending "_cdn"', () => {
         const repository = new Repository({
            name: 'Rep_cdn',
            dir: 'src/dir',
            path: 'src/dir/Rep_cdn'
         });

         expect(repository.isCDN()).toBeTruthy();
      });

      test('should return true if name ending "-cdn"', () => {
         const repository = new Repository({
            name: 'Rep-cdn',
            dir: 'src/dir',
            path: 'src/dir/Rep-cdn'
         });

         expect(repository.isCDN()).toBeTruthy();
      });

      test('should return false if name not ending "-cdn" or "_cdn"', () => {
         const repository = new Repository(defaultOptions);

         expect(repository.isCDN()).toBeFalsy();
      });
   });

   describe('serialize()', () => {
      test('should return repository in object format', () => {
         const repository = new Repository({
            ...defaultOptions,
            url: 'url',
            initialized: true,
            HEAD: 'HEAD'
         });

         expect(repository.serialize()).toEqual({
            dir: 'src/dir',
            name: 'Rep',
            url: 'url',
            path: 'src/dir/Rep',
            loadHistory: true,
            initialized: true,
            HEAD: 'HEAD'
         });
      });
   });

   describe('getRemoteRevision()', () => {
      let stubLsRemote;
      let repository;

      beforeEach(() => {
         repository = new Repository(defaultOptions);

         stubLsRemote = jest.spyOn(repository, 'lsRemote').mockReturnValue([
            '11111\trefs/heads/rc-22.7000',
            '22222\trefs/heads/rc-22.7100'
         ]);
      });

      afterEach(() => {
         stubLsRemote.mockRestore();
      });

      test('should return revision from branch', async() => {
         expect(await repository.getRemoteRevision('rc-22.7000')).toStrictEqual('11111');
      });
   });

   describe('getRemoteBranch()', () => {
      let stubLsRemote;
      let repository;

      beforeEach(() => {
         repository = new Repository(defaultOptions);

         stubLsRemote = jest.spyOn(repository, 'lsRemote').mockImplementation(async(branch) => {
            if (branch === 'rc-22.7*') {
               return [
                  '11111\trefs/heads/rc-22.7000',
                  '22222\trefs/heads/rc-22.7100'
               ];
            }

            return [];
         });
      });

      afterEach(() => {
         stubLsRemote.mockRestore();
      });

      test('should return list branch by mask', async() => {
         expect(await repository.getRemoteBranches('rc-22.7*')).toEqual([
            'rc-22.7000',
            'rc-22.7100'
         ]);
      });

      test('should return empty list if branch are not exists', async() => {
         expect(await repository.getRemoteBranches('rc-22.6*')).toEqual([]);
      });
   });
});
