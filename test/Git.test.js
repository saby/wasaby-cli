const fs = require('fs-extra');

const Git = require('../src/Utils/Git');
const CMD = require('../src/Utils/CMD');
const pathUtils = require('../src/Utils/path');

const REPOS_DIR = '/tmp/repos/';
const REPOS_NAME = 'test-repos';
const REPOS_PATH = pathUtils.join(REPOS_DIR, REPOS_NAME);
const REPOS_URL = 'https://git.sbis.ru/test/test-repos.git';

jest.mock('../src/Utils/Logger', () => ({
   error: () => {},
   debug: () => {},
   info: () => {},
   writeFile: () => Promise.resolve(),
   dir: 'src/logs'
}));

describe('Git', () => {
   let stubExecute;
   let git;

   beforeEach(() => {
      const cmd = new CMD();

      stubExecute = jest.spyOn(cmd, 'execute').mockReturnValue(Promise.resolve([]));
      git = new Git({
         url: REPOS_URL,
         name: REPOS_NAME,
         dir: REPOS_DIR,
         path: REPOS_PATH,
         HEAD: '123456789',
         cmd
      });
   });

   afterEach(() => {
      stubExecute.mockRestore();
   });

   describe('clone()', () => {
      test('Should execute correct "clone" command', async() => {
         await git.clone();

         expect(stubExecute.mock.calls.length).toStrictEqual(1);
         expect(stubExecute.mock.calls[0]).toEqual([
            `git clone ${REPOS_URL} ${REPOS_NAME}`,
            REPOS_DIR,
            {
               processName: `${REPOS_NAME} git clone ${REPOS_URL} ${REPOS_NAME}`,
               silent: true
            }
         ]);
      });

      test('should return exception if not could clone repository', async() => {
         stubExecute.mockReturnValue(Promise.reject('error clone'));

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

         expect(stubExecute.mock.calls.length).toStrictEqual(0);
      });

      test('should execute fetch', async() => {
         await git.fetch('--all');

         expect(stubExecute.mock.calls.length).toStrictEqual(1);
         expect(stubExecute.mock.calls[0]).toEqual([
            'git fetch --all',
            REPOS_PATH,
            {
               processName: `${REPOS_NAME} git fetch --all`,
               silent: true
            }
         ]);
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

         expect(stubExecute.mock.calls.length).toStrictEqual(0);
      });

      test('Should execute pull', async() => {
         await git.pull('--all --prune');

         expect(stubExecute.mock.calls.length).toStrictEqual(1);
         expect(stubExecute.mock.calls[0]).toEqual([
            'git pull --all --prune',
            REPOS_PATH,
            {
               processName: `${REPOS_NAME} git pull --all --prune`,
               silent: true
            }
         ]);
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

         expect(stubExecute.mock.calls.length).toStrictEqual(0);
      });

      test('Should execute clean', async() => {
         await git.clean('-fdx');

         expect(stubExecute.mock.calls.length).toStrictEqual(1);
         expect(stubExecute.mock.calls[0]).toEqual([
            'git clean -fdx',
            REPOS_PATH,
            {
               processName: `${REPOS_NAME} git clean -fdx`,
               silent: true
            }
         ]);
      });
   });

   describe('checkout()', () => {
      test('not should execute checkout if options freezeStateOfCommits false', async() => {
         git.freezeStateOfCommits = true;

         await git.checkout('branch');

         expect(stubExecute.mock.calls.length).toStrictEqual(0);
      });

      test('Should execute checkout', async() => {
         const branch = 'remotes/origin/checkout-branch-name';

         await git.checkout(branch, '-f');

         expect(stubExecute.mock.calls.length).toStrictEqual(1);
         expect(stubExecute.mock.calls[0]).toEqual([
            `git checkout -f ${branch}`,
            REPOS_PATH,
            {
               processName: `${REPOS_NAME} git checkout -f ${branch}`,
               silent: true
            }
         ]);
      });

      test('should return exception if could not checkout to branch', async() => {
         const branch = 'remotes/origin/checkout-branch-name';

         stubExecute.mockReturnValue(Promise.reject('error checkout'));
         expect.assertions(1);

         try {
            await git.checkout(branch, '-f');
         } catch (err) {
            expect(err.message).toStrictEqual(`Error checkout to ${branch} in repository ${REPOS_NAME}: error checkout`);
         }
      });
   });

   describe('merge()', () => {
      test('not should execute merge if options freezeStateOfCommits false', async() => {
         git.freezeStateOfCommits = true;

         await git.merge('branch');

         expect(stubExecute.mock.calls.length).toStrictEqual(0);
      });

      test('should execute merge for branch', async() => {
         const branch = 'merge-branch-name';

         await git.merge(branch);

         expect(stubExecute.mock.calls.length).toStrictEqual(1);
         expect(stubExecute.mock.calls[0]).toEqual([
            `git merge remotes/origin/${branch}`,
            REPOS_PATH,
            {
               processName: `${REPOS_NAME} git merge remotes/origin/${branch}`,
               silent: true
            }
         ]);
      });

      test('should execute merge for revision', async() => {
         const revision = '123fff';

         await git.merge(revision);

         expect(stubExecute.mock.calls.length).toStrictEqual(1);
         expect(stubExecute.mock.calls[0]).toEqual([
            `git merge ${revision}`,
            REPOS_PATH,
            {
               processName: `${REPOS_NAME} git merge ${revision}`,
               silent: true
            }
         ]);
      });

      test('should execute abort merge and return exception if could not merge branches', async() => {
         const branch = 'merge-branch-name';

         stubExecute.mockImplementation(command => (command.includes('--abort') ? Promise.resolve() : Promise.reject('Fail merge')));

         expect.assertions(4);

         try {
            await git.merge(branch);
         } catch (err) {
            expect(stubExecute.mock.calls.length).toStrictEqual(2);
            expect(stubExecute.mock.calls[0]).toEqual([
               `git merge remotes/origin/${branch}`,
               REPOS_PATH,
               {
                  processName: `${REPOS_NAME} git merge remotes/origin/${branch}`,
                  silent: true
               }
            ]);
            expect(stubExecute.mock.calls[1]).toEqual([
               `git merge --abort remotes/origin/${branch}`,
               REPOS_PATH,
               {
                  processName: `${REPOS_NAME} git merge --abort remotes/origin/${branch}`,
                  force: true,
                  silent: true
               }
            ]);
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
         stubExecute.mockReturnValue(Promise.resolve(['D\tModule1/file.ts\nM\tModule2', '/file.ts\n']));

         const startRevision = '18ffe7779234bd02da0b291228f8155e69ca18e0';
         const endRevision = '7cdbb8baa95b0e9304c727b906e7522cc4d6ac46';

         expect(await git.diff(startRevision, endRevision, '--raw')).toEqual([
            'D\tModule1/file.ts',
            'M\tModule2/file.ts'
         ]);
         expect(stubExecute.mock.calls.length).toStrictEqual(1);
         expect(stubExecute.mock.calls[0]).toEqual([
            `git --no-pager diff --raw ${startRevision} ${endRevision}`,
            REPOS_PATH,
            {
               processName: `${REPOS_NAME} git --no-pager diff --raw ${startRevision} ${endRevision}`,
               silent: true
            }
         ]);
      });
   });

   describe('branch()', () => {
      test('Should execute branch command', async() => {
         stubExecute.mockReturnValue(Promise.resolve(['remote/origin/myBranch\nremote/origin/branch\n']));

         const branch = 'remotes/origin/branch-name';

         expect(await git.branch(branch, '--remotes')).toEqual([
            'remote/origin/myBranch',
            'remote/origin/branch'
         ]);
         expect(stubExecute.mock.calls.length).toStrictEqual(1);
         expect(stubExecute.mock.calls[0]).toEqual([
            `git --no-pager branch --remotes ${branch}`,
            REPOS_PATH,
            {
               processName: `${REPOS_NAME} git --no-pager branch --remotes ${branch}`,
               silent: true,
               maxBuffer: 1024 * 1024 * 2
            }
         ]);
      });
   });

   describe('revParse()', () => {
      test('Should execute revParse command', async() => {
         stubExecute.mockReturnValue(Promise.resolve(['re', 'v1\n']));

         const revision = '7cdbb8baa95b0e9304c727b906e7522cc4d6ac46';

         expect(await git.revParse(revision, '--all')).toStrictEqual('rev1');

         expect(stubExecute.mock.calls.length).toStrictEqual(1);
         expect(stubExecute.mock.calls[0]).toEqual([
            `git rev-parse --all ${revision}`,
            REPOS_PATH,
            {
               processName: `${REPOS_NAME} git rev-parse --all ${revision}`,
               silent: true
            }
         ]);
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

         expect(stubExecute.mock.calls.length).toStrictEqual(0);
      });

      test('should execute reset', async() => {
         await git.reset('--hard');

         expect(stubExecute.mock.calls.length).toStrictEqual(1);
         expect(stubExecute.mock.calls[0]).toEqual([
            'git reset --hard',
            REPOS_PATH,
            {
               processName: `${REPOS_NAME} git reset --hard`,
               silent: true
            }
         ]);
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
      let stubExecute;

      beforeEach(() => {
         stubExecute = jest.spyOn(CMD.prototype, 'execute').mockReturnValue(Promise.resolve(['src/rep']));
      });

      afterEach(() => {
         stubExecute.mockRestore();
      });

      test('should return path to local rep', async() => {
         expect(await Git.getRoot('src/rep/module')).toStrictEqual('src/rep');

         expect(stubExecute.mock.calls.length).toStrictEqual(1);
         expect(stubExecute.mock.calls[0]).toEqual([
            'git rev-parse --show-toplevel',
            'src/rep/module',
            {
               silent: true
            }
         ]);
      });

      test('should trim path before return it', async() => {
         stubExecute.mockReturnValue(Promise.resolve([' src/rep ']));

         expect(await Git.getRoot('src/rep/module')).toStrictEqual('src/rep');

         expect(stubExecute.mock.calls.length).toStrictEqual(1);
         expect(stubExecute.mock.calls[0]).toEqual([
            'git rev-parse --show-toplevel',
            'src/rep/module',
            {
               silent: true
            }
         ]);
      });

      test('should return exception if could not detect root repository', async() => {
         stubExecute.mockReturnValue(Promise.reject('error detect root'));

         expect.assertions(1);

         try {
            await Git.getRoot('src/rep/module');
         } catch (err) {
            expect(err).toStrictEqual('error detect root');
         }
      });
   });

   describe('getUrl()', () => {
      let stubExecute;

      beforeEach(() => {
         stubExecute = jest.spyOn(CMD.prototype, 'execute').mockReturnValue(Promise.resolve(['https:/git/rep']));
      });

      afterEach(() => {
         stubExecute.mockRestore();
      });

      test('should return path to local rep', async() => {
         expect(await Git.getUrl('src/rep/module')).toStrictEqual('https:/git/rep');

         expect(stubExecute.mock.calls.length).toStrictEqual(1);
         expect(stubExecute.mock.calls[0]).toEqual([
            'git config --get remote.origin.url',
            'src/rep/module',
            {
               silent: true
            }
         ]);
      });

      test('should trim path before return it', async() => {
         stubExecute.mockReturnValue(Promise.resolve([' https:/git/rep ']));

         expect(await Git.getUrl('src/rep/module')).toStrictEqual('https:/git/rep');

         expect(stubExecute.mock.calls.length).toStrictEqual(1);
         expect(stubExecute.mock.calls[0]).toEqual([
            'git config --get remote.origin.url',
            'src/rep/module',
            {
               silent: true
            }
         ]);
      });

      test('should return exception if could not detect root repository', async() => {
         stubExecute.mockReturnValue(Promise.reject('error detect url'));

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

         expect(stubExecute.mock.calls.length).toStrictEqual(1);
         expect(stubExecute.mock.calls[0]).toEqual([
            'git config core.quotepath false',
            REPOS_PATH,
            {
               silent: true
            }
         ]);
      });
   });
});
