const fs = require('fs-extra');

const Git = require('../src/Utils/Git');
const GitProcess = require('../src/Process/Git');
const pathUtils = require('../src/Utils/path');

const REPOS_DIR = '/tmp/repos/';
const REPOS_NAME = 'test-repos';
const REPOS_PATH = pathUtils.join(REPOS_DIR, REPOS_NAME);
const REPOS_URL = 'git@git.sbis.ru:test/test-repos.git';

jest.mock('../src/Utils/Logger', () => ({
   error: () => jest.fn(),
   debug: () => jest.fn(),
   info: () => jest.fn(),
   writeFile: jest.fn().mockImplementation(() => Promise.resolve()),
   dir: 'src/logs'
}));

const mockRun = jest.fn();
jest.mock('../src/Process/Git', () => {
   return jest.fn().mockImplementation(() => {
      return {
         run: mockRun
      };
   });
});


describe('Git', () => {
   let git;

   function checkGitProcess(command, options, params, cfg, path, numberCall = 0) {
      expect(GitProcess.mock.calls[numberCall][0]).toEqual({
         command,
         options,
         params,
         silent: true,
         processName: `${REPOS_NAME} ${command}`,
         procOptions: {
            cwd: path || REPOS_PATH
         },
         ...cfg
      });
   }

   beforeEach(() => {
      GitProcess.mockClear();
      mockRun.mockReturnValue(Promise.resolve());
      jest.spyOn(fs, 'ensureDirSync').mockImplementation(() => true);

      git = new Git({
         url: REPOS_URL,
         name: REPOS_NAME,
         dir: REPOS_DIR,
         path: REPOS_PATH,
         HEAD: '123456789'
      });
   });

   afterEach(() => {
      mockRun.mockClear();
   });

   describe('clone()', () => {
      test('Should execute correct "clone" command', async() => {
         await git.clone();

         expect(GitProcess.mock.calls.length).toStrictEqual(1);
         checkGitProcess(
            'clone',
            undefined,
            [
               REPOS_URL,
               REPOS_NAME
            ],
            undefined,
            REPOS_DIR
         );
      });

      test('should return exception if not could clone repository', async() => {
         mockRun.mockReturnValue(Promise.reject('error clone'));

         expect.assertions(1);

         try {
            await git.clone();
         } catch (err) {
            expect(err.message).toStrictEqual(`Ошибка при клонировании репозитория ${REPOS_NAME}: error clone`);
         }
      });
   });

   describe('fetch()', () => {
      let stubIsConnectedRemote;

      beforeEach(() => {
         stubIsConnectedRemote = jest.spyOn(git, 'isConnectedRemote').mockReturnValue(Promise.resolve(true));
      });

      afterEach(() => {
         stubIsConnectedRemote.mockRestore();
      });

      test('not should execute fetch if options freezeStateOfCommits false', async() => {
         git.freezeStateOfCommits = true;

         await git.fetch();

         expect(GitProcess.mock.calls.length).toStrictEqual(0);
      });

      test('should execute fetch', async() => {
         await git.fetch({
            all: true
         });

         expect(GitProcess.mock.calls.length).toStrictEqual(2);
         checkGitProcess(
             'fetch',
             {
                all: true
             },
             undefined,
             undefined,
             undefined,
             1
         );
      });

      test('should return exception if no remote repository specified', async() => {
         stubIsConnectedRemote.mockReturnValue(false);

         expect.assertions(1);

         try {
            await git.fetch();
         } catch (err) {
            expect(err.message).toStrictEqual(`${REPOS_NAME}: No remote repository specified`);
         }
      });
   });

   describe('pull()', () => {
      let stubIsConnectedRemote;

      beforeEach(() => {
         stubIsConnectedRemote = jest.spyOn(git, 'isConnectedRemote').mockReturnValue(Promise.resolve(true));
      });

      afterEach(() => {
         stubIsConnectedRemote.mockRestore();
      });

      test('not should execute pull if options freezeStateOfCommits false', async() => {
         git.freezeStateOfCommits = true;

         await git.pull();

         expect(GitProcess.mock.calls.length).toStrictEqual(0);
      });

      test('Should execute pull', async() => {
         await git.pull({
            all: true,
            prune: true
         });

         expect(GitProcess.mock.calls.length).toStrictEqual(2);
         checkGitProcess(
            'pull',
            {
               all: true,
               prune: true
            },
             undefined,
             undefined,
             undefined,
             1
         );
      });

      test('should return exception if no remote repository specified', async() => {
         stubIsConnectedRemote.mockReturnValue(false);

         expect.assertions(1);

         try {
            await git.pull();
         } catch (err) {
            expect(err.message).toStrictEqual(`${REPOS_NAME}: No remote repository specified`);
         }
      });
   });

   describe('clean()', () => {
      test('not should execute clean if options freezeStateOfCommits false', async() => {
         git.freezeStateOfCommits = true;

         await git.clean();

         expect(GitProcess.mock.calls.length).toStrictEqual(0);
      });

      test('Should execute clean', async() => {
         await git.clean({
            force: true,
            d: true,
            x: true
         });

         expect(GitProcess.mock.calls.length).toStrictEqual(1);
         checkGitProcess(
            'clean',
            {
               force: true,
               d: true,
               x: true
            }
         );
      });
   });

   describe('checkout()', () => {
      test('not should execute checkout if options freezeStateOfCommits false', async() => {
         git.freezeStateOfCommits = true;

         await git.checkout('branch');

         expect(GitProcess.mock.calls.length).toStrictEqual(0);
      });

      test('Should execute checkout', async() => {
         const branch = 'remotes/origin/checkout-branch-name';

         await git.checkout(branch, {
            force: true
         });

         expect(GitProcess.mock.calls.length).toStrictEqual(1);
         checkGitProcess(
            'checkout',
            {
               force: true
            },
            [
               branch
            ]
         );
      });

      test('should return exception if could not checkout to branch', async() => {
         const branch = 'remotes/origin/checkout-branch-name';

         mockRun.mockReturnValue(Promise.reject('error checkout'));
         expect.assertions(1);

         try {
            await git.checkout(branch, {
               force: true
            });
         } catch (err) {
            expect(err.message).toStrictEqual(`Error checkout to ${branch} in repository ${REPOS_NAME}: error checkout`);
         }
      });
   });

   describe('merge()', () => {
      test('not should execute merge if options freezeStateOfCommits false', async() => {
         git.freezeStateOfCommits = true;

         await git.merge('branch');

         expect(GitProcess.mock.calls.length).toStrictEqual(0);
      });

      test('should execute merge for branch', async() => {
         const branch = 'merge-branch-name';

         await git.merge(branch);

         expect(GitProcess.mock.calls.length).toStrictEqual(1);
         checkGitProcess(
            'merge',
            undefined,
            [
               `remotes/origin/${branch}`
            ]
         );
      });

      test('should execute merge for revision', async() => {
         const revision = '123fff';

         await git.merge(revision);

         expect(GitProcess.mock.calls.length).toStrictEqual(1);
         checkGitProcess(
            'merge',
            undefined,
            [
               revision
            ]
         );
      });

      test('should execute abort merge and return exception if could not merge branches', async() => {
         const branch = 'merge-branch-name';

         let fail = false;
         mockRun.mockImplementation(() => {
            if (!fail) {
               fail = true;
               return Promise.reject('Fail merge');
            }

            return Promise.resolve();
         });

         expect.assertions(4);

         try {
            await git.merge(branch);
         } catch (err) {
            expect(GitProcess.mock.calls.length).toStrictEqual(2);
            checkGitProcess(
               'merge',
               undefined,
               [
                  `remotes/origin/${branch}`
               ]
            );
            checkGitProcess(
               'merge',
               {
                  abort: true
               },
               [
                  `remotes/origin/${branch}`
               ],
               {
                  force: true
               },
               undefined,
               1
            );
            expect(err.message).toStrictEqual(`Conflict in repository ${REPOS_NAME} when merging current branch with 'remotes/origin/${branch}': Fail merge`);
         }
      });
   });

   describe('diff()', () => {
      let stubPrepareConfigGit;

      beforeEach(() => {
         stubPrepareConfigGit = jest.spyOn(git, '_prepareConfigGit').mockReturnValue(Promise.resolve());
      });

      afterEach(() => {
         stubPrepareConfigGit.mockRestore();
      });

      test('Should execute diff', async() => {
         mockRun.mockReturnValue(Promise.resolve(['D\tModule1/file.ts\nM\tModule2', '/file.ts\n']));

         const startRevision = '18ffe7779234bd02da0b291228f8155e69ca18e0';
         const endRevision = '7cdbb8baa95b0e9304c727b906e7522cc4d6ac46';

         expect(await git.diff(startRevision, endRevision, { raw: true })).toEqual([
            'D\tModule1/file.ts',
            'M\tModule2/file.ts'
         ]);
         expect(GitProcess.mock.calls.length).toStrictEqual(1);
         checkGitProcess(
            'diff',
            {
               raw: true
            },
            [
               startRevision,
               endRevision
            ]
         );
      });
   });

   describe('branch()', () => {
      test('Should execute branch command', async() => {
         mockRun.mockReturnValue(Promise.resolve(['remote/origin/myBranch\nremote/origin/branch\n']));

         const branch = 'remotes/origin/branch-name';

         expect(await git.branch(branch, { remotes: true })).toEqual([
            'remote/origin/myBranch',
            'remote/origin/branch'
         ]);
         expect(GitProcess.mock.calls.length).toStrictEqual(1);
         checkGitProcess(
            'branch',
            {
               remotes: true
            },
            [
               branch
            ],
            {
               maxBuffer: 1024 * 1024 * 2
            }
         );
      });
   });

   describe('revParse()', () => {
      test('Should execute revParse command', async() => {
         mockRun.mockReturnValue(Promise.resolve(['re', 'v1\n']));

         const revision = '7cdbb8baa95b0e9304c727b906e7522cc4d6ac46';

         expect(await git.revParse(revision, { all: true })).toStrictEqual('rev1');

         expect(GitProcess.mock.calls.length).toStrictEqual(1);
         checkGitProcess(
            'rev-parse',
            {
               all: true
            },
            [
               revision
            ]
         );
      });
   });

   describe('reset()', () => {
      let stubIsConnectedRemote;

      beforeEach(() => {
         stubIsConnectedRemote = jest.spyOn(git, 'isConnectedRemote').mockReturnValue(Promise.resolve(true));
      });

      afterEach(() => {
         stubIsConnectedRemote.mockRestore();
      });

      test('not should execute reset if options freezeStateOfCommits false', async() => {
         git.freezeStateOfCommits = true;

         await git.reset();

         expect(GitProcess.mock.calls.length).toStrictEqual(0);
      });

      test('should execute reset', async() => {
         await git.reset({
            hard: true
         });

         expect(GitProcess.mock.calls.length).toStrictEqual(1);
         checkGitProcess(
            'reset',
            {
               hard: true
            }
         );
      });
   });

   describe('isConnectedRemote()', () => {
      let stubPathExistsSync;
      let stubReadFile;

      beforeEach(() => {
         stubPathExistsSync = jest.spyOn(fs, 'pathExistsSync').mockReturnValue(true);
         stubReadFile = jest.spyOn(fs, 'readFile')
            .mockReturnValue('[remote "origin"] url = https/git fetch = +refs/heads');
      });

      afterEach(() => {
         stubPathExistsSync.mockRestore();
         stubReadFile.mockRestore();
      });

      test('should return true if config exists and it has remote repository url', async() => {
         expect(await git.isConnectedRemote()).toBeTruthy();
      });

      test('should return false if config not exists', async() => {
         stubPathExistsSync.mockReturnValue(false);

         expect(await git.isConnectedRemote()).toBeFalsy();
      });

      test('should return false if config exists but it not has remote repository url', async() => {
         stubReadFile.mockReturnValue('[remote "origin"] fetch = +refs/heads');

         expect(await git.isConnectedRemote()).toBeFalsy();
      });
   });

   describe('getRoot()', () => {
      test('should return path to local rep', async() => {
         mockRun.mockReturnValue(Promise.resolve([' src/rep ']));

         expect(await Git.getRoot('src/rep/module')).toStrictEqual('src/rep');

         expect(GitProcess.mock.calls.length).toStrictEqual(1);
         checkGitProcess(
            'rev-parse',
            {
               'show-toplevel': true
            },
            undefined,
            {
               processName: undefined,
            },
            'src/rep/module'
         );
      });

      test('should trim path before return it', async() => {
         mockRun.mockReturnValue(Promise.resolve([' src/rep ']));

         expect(await Git.getRoot('src/rep/module')).toStrictEqual('src/rep');

         expect(GitProcess.mock.calls.length).toStrictEqual(1);
         checkGitProcess(
            'rev-parse',
            {
               'show-toplevel': true
            },
            undefined,
            {
               processName: undefined,
            },
            'src/rep/module'
         );
      });

      test('should return exception if could not detect root repository', async() => {
         mockRun.mockReturnValue(Promise.reject('error detect root'));

         expect.assertions(1);

         try {
            await Git.getRoot('src/rep/module');
         } catch (err) {
            expect(err).toStrictEqual('error detect root');
         }
      });
   });

   describe('getUrl()', () => {
      test('should return path to local rep', async() => {
         mockRun.mockReturnValue(Promise.resolve([' https:/git/rep ']));

         expect(await Git.getUrl('src/rep/module')).toStrictEqual('https:/git/rep');

         expect(GitProcess.mock.calls.length).toStrictEqual(1);
         checkGitProcess(
            'config',
            {
               get: true
            },
            [
               'remote.origin.url'
            ],
            {
               processName: undefined,
            },
            'src/rep/module'
         );
      });

      test('should trim path before return it', async() => {
         mockRun.mockReturnValue(Promise.resolve([' https:/git/rep ']));

         expect(await Git.getUrl('src/rep/module')).toStrictEqual('https:/git/rep');

         expect(GitProcess.mock.calls.length).toStrictEqual(1);
         checkGitProcess(
            'config',
            {
               get: true
            },
            [
               'remote.origin.url'
            ],
            {
               processName: undefined,
            },
            'src/rep/module'
         );
      });

      test('should return exception if could not detect root repository', async() => {
         mockRun.mockReturnValue(Promise.reject('error detect url'));

         expect.assertions(1);

         try {
            await Git.getUrl('src/rep/module');
         } catch (err) {
            expect(err).toStrictEqual('error detect url');
         }
      });
   });

   describe('getInfo()', () => {
      let stubGetRoot;
      let stubGetUrl;

      beforeEach(() => {
         stubGetRoot = jest.spyOn(Git, 'getRoot').mockReturnValue('src/rep');
         stubGetUrl = jest.spyOn(Git, 'getUrl').mockReturnValue('https://git/group/rep');
      });

      afterEach(() => {
         stubGetRoot.mockRestore();
         stubGetUrl.mockRestore();
      });

      test('should return info about repository', async() => {
         expect(await Git.getInfo('src/rep/module')).toEqual({
            url: 'https://git/group/rep',
            dir: 'src',
            name: 'group_rep',
            path: 'src/rep'
         });
      });
   });

   describe('getNameFromUrl()', () => {
      test('should return name for https url', () => {
         expect(Git.getNameFromUrl('https://git/group/rep')).toStrictEqual('group_rep');
      });

      test('should return name for git url', () => {
         expect(Git.getNameFromUrl('git@git:group/rep.git')).toStrictEqual('group_rep');
      });
   });

   describe('_prepareConfigGit()', () => {
      test('should one prepare git config once', async() => {
         await Promise.all([
            git._prepareConfigGit(),
            git._prepareConfigGit()
         ]);

         expect(GitProcess.mock.calls.length).toStrictEqual(1);

         checkGitProcess(
            'config',
            undefined,
            [
               'core.quotepath',
               false
            ]
         );
      });
   });
});
