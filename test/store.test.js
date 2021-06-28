//tslint:disable:no-unused-expression
//tslint:disable:one-variable-per-declaration
const chai = require('chai');
const sinon = require('sinon');
const fs = require('fs-extra');
const Store = require('../app/store');
const shell = require('../app/util/shell');

let store;
let stubExecute;
let stubfsAppend;
describe('Store', () => {
   beforeEach(() => {
      stubExecute = sinon.stub(shell.prototype, 'execute').callsFake(() => {});

      const options = new Map([
         ['rc', 'rc-12'],
         ['store', ''],
         ['repositories', {
            test1: {},
            test2: {}
         }],
         ['rep', ['name']]
      ]);
      store = new Store({
         options
      });

      stubfsAppend = sinon.stub(fs, 'appendFileSync').callsFake(() => undefined);
   });

   afterEach(() => {
      stubExecute.restore();
      stubfsAppend.restore();
   });

   describe('initRep', () => {
      let stubCheckout;
      let stubClone;
      let stubMkDir;
      let originalRepos;

      beforeEach(() => {
         originalRepos = store.options.get('repositories');

         store.options.set('repositories', {
            test: {}
         });

         stubMkDir = sinon.stub(fs, 'mkdirs').callsFake(() => {
            return Promise.resolve();
         });
      });

      afterEach(() => {
         store.options.set('repositories', originalRepos);

         stubCheckout.restore();
         stubClone.restore();
         stubMkDir.restore();
      });

      it('should checkout brunch', (done) => {
         stubCheckout = sinon.stub(store, 'checkout').callsFake((name, branch) => {
            chai.expect(name).to.equal('test');
            chai.expect(branch).to.equal(store.options.get('rc'));
            done();
         });
         stubClone = sinon.stub(store, 'cloneRepToStore').callsFake((name) => {
            chai.expect(name).to.equal('test');
            return Promise.resolve('testPath');
         });

         store.initRep('test');
      });

      it('should checkout brunch version 19.999/test', (done) => {
         stubCheckout = sinon.stub(store, 'checkout').callsFake((name, branch, pathToRepos) => {
            chai.expect(branch).to.equal('19.999/test');
            done();
         });
         stubClone = sinon.stub(store, 'cloneRepToStore').callsFake((name) => {
            return Promise.resolve();
         });
         store.options.set('test', '19.999/test');

         store.initRep('test');

         store.options.delete('test');
      });
   });

   describe('.cloneRepToStore()', () => {
      let stubfs;
      let originalRepos;

      beforeEach(() => {
         originalRepos = store.options.get('repositories');

         store.options.set('repositories', {
            test: {
               url: 'test@test.git'
            }
         });

         stubfs = sinon.stub(fs, 'existsSync').callsFake(() => false);
      });

      afterEach(() => {
         store.options.set('repositories', originalRepos);
         stubfs.restore();
      });

      it('cloneRepToStore', (done) => {
         stubExecute.callsFake((cmd) => {
            chai.expect(cmd).to.equal('git clone test@test.git test');
            done();

            return Promise.resolve();
         });

         store.cloneRepToStore('test');

      });

      it('cloneRepToStore2', (done) => {
         stubExecute.callsFake((cmd) => {
            return Promise.reject();
         });

         store.cloneRepToStore('pathToTest', 'test').catch(() => {
            done();
         });
      });
   });

   describe('.checkout()', () => {
      let stubModule;
      let stubReadJSON;
      let stubExists;
      let originalTestRep;

      beforeEach(() => {
         originalTestRep = store.options.get('rep');

         stubReadJSON = sinon.stub(fs, 'readJSONSync').callsFake((name) => {
            if (name.includes('package.json')) {
               return  {
                  name: 'wasaby-cli',
                  version: '20.4000.0'
               }
            }
            return stubReadJSON.wrappedMethod();
         });

         stubExists = sinon.stub(fs, 'existsSync').callsFake(name => name.includes('package.json'));
      });

      afterEach(() => {
         store.options.set('rep', originalTestRep);
         stubReadJSON.restore();
         stubExists.restore();
      });

      it('should checkout branch', (done) => {
         stubExecute.callsFake((cmd, path, params) => {
            if (typeof params.processName === 'string' && params.processName.includes('checkout')) {
               chai.expect(cmd).to.equal('git checkout -f 20.1000/branch');
               done();
            }
            return Promise.resolve();
         });

         store.checkout('name', '20.1000/branch');
      });

      it('should throw error if checkoutBranch is undefined', (done) => {
         store.checkout('name').catch(() => {
            done();
         });
      });

      it('should merge branch with rc', (done) => {
         const commandsArray = [];

         stubExecute.callsFake((cmd) => {
            commandsArray.push(cmd);
            return Promise.resolve();
         });

         store.options.set('rep', ['test']);

         store.checkout('test', '20.1000/branch').then(() => {
            chai.expect(`git merge remotes/origin/rc-20.1000`).to.equal(commandsArray[5]);
            done();
         });
      });

      it('should merge branch with rc if rep is additional', (done) => {
         const commandsArray = [];

         stubExecute.callsFake((cmd) => {
            commandsArray.push(cmd);
            return Promise.resolve();
         });

         store.options.set('rep', ['test']);

         store.checkout('testAdd', '20.1000/branch').then(() => {
            chai.expect(`git merge remotes/origin/rc-20.1000`).to.equal(commandsArray[5]);
            done();
         });
      });

      it('should throw error if merge is failed', (done) => {
         stubExecute.callsFake((cmd) => {
            if (cmd.includes('merge')) {
               throw new Error();
            }
         });

         store.options.set('rep', ['test']);

         store.checkout('test', 'branch').catch(() => {
            done();
         });
      });

      it('should throw error if checkout is failed', (done) => {
         stubExecute.callsFake((cmd) => {
            if (cmd.includes('checkout')) {
               return Promise.reject();
            } else {
               return Promise.resolve();
            }
         });

         store.options.set('rep', ['test']);

         store.checkout('test', '20.1000/branch').catch(() => {
            done();
         });
      });

      it('should reset rep to commit', (done) => {
         stubExecute.callsFake((cmd, path, params) => {
            if (typeof params.processName === 'string' && params.processName.includes('reset')) {
               chai.expect(cmd).to.equal('git reset --hard b2563dfa');
               done();
            }

            return Promise.resolve();
         });

         store.checkout('name', 'b2563dfa');
      });

      it('should checkout branch when gived branch whats merged with current', (done) => {
         stubExecute.callsFake((cmd, path, params) => {
            if (typeof params.processName === 'string' && params.processName.includes('checkout')) {
               chai.expect(cmd).to.equal('git checkout -f my/branch');
               done();
            }

            return Promise.resolve();
         });

         store.checkout('name', 'my/branch:rc-20.4000');
      });

      it('should merge with given branch', (done) => {
         stubExecute.callsFake((cmd, path, params) => {
            if (typeof params.processName === 'string' && params.processName === 'name git merge') {
               chai.expect(cmd).to.equal('git merge remotes/origin/rc-20.4000');
               done();
            }

            return Promise.resolve();
         });

         store.checkout('name', 'my/branch:rc-20.4000');
      });

      it('should merge with given commit hash', (done) => {
         stubExecute.callsFake((cmd, path, params) => {
            if (typeof params.processName === 'string' && params.processName === 'name git merge') {
               chai.expect(cmd).to.equal('git merge 123qasdawe');
               done();
            }

            return Promise.resolve();
         });

         store.checkout('name', 'my/branch:123qasdawe');
      });
   });

   describe('.run()', () => {
      let stubmkdirs;
      let initRepStore;
      let originalRepos

      beforeEach(() => {
         originalRepos =  store.options.get('repositories');
      });

      afterEach(() => {
         store.options.set('repositories', originalRepos);
         stubmkdirs && stubmkdirs.restore();
         initRepStore && initRepStore.restore();
      });

      it('should make store dir', (done) => {
         let makeDir;

         store.options.set('repositories', {});

         stubmkdirs = sinon.stub(fs, 'mkdirs').callsFake((path) => {
            makeDir = path;
         });
         initRepStore = sinon.stub(store, 'initRep').callsFake(() => {});

         store.run().then(() => {
            chai.expect(makeDir).to.equal(store.options.get('store'));
            done();
         });
      });
   });

   describe('._getForceLoadRepos()', () => {
      let originalRepos;

      beforeEach(() => {
         originalRepos =  store.options.get('repositories');
      });

      afterEach(() => {
         store.options.set('repositories', originalRepos);
      });

      it('should make store dir', () => {
         store.options.set('repositories', {
            test: {
               name: 'test',
               load: true
            }
         });

         chai.expect(new Set(['test'])).to.deep.equal(store._getForceLoadRepos());
      });
   });
});
