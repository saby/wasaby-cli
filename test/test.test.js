const chai = require('chai');
const path = require('path');
const sinon = require('sinon');
const fs = require('fs-extra');
const Test = require('../app/test');
let xml = require('../app/xml/xml');
const shell = require('../app/util/shell');

let test;
let stubfsAppend;
let stubExecute;
let stubSpawn;
describe('Test', () => {
   beforeEach(() => {
      const options = new Map([
         ['rc', 'rc-12'],
         ['store', ''],
         ['repositories', {
            test1: {},
            test2: {}
         }],
         ['workspace', ''],
         ['workDir', ''],
         ['resources', ''],
         ['rep', ['test1']]
      ]);

      test = new Test({
         options
      });

      stubfsAppend = sinon.stub(fs, 'appendFileSync').callsFake(() => undefined);
      stubExecute = sinon.stub(shell.prototype, 'execute').callsFake(() => Promise.resolve());
      stubSpawn = sinon.stub(shell.prototype, 'spawn').callsFake(() => Promise.resolve());
   });

   afterEach(() => {
      stubExecute.restore();
      stubfsAppend.restore();
      stubSpawn.restore();
   });

   describe('._makeTestConfig()', () => {
      let stubfs;
      let stubTestList;

      beforeEach(() => {
         stubTestList = sinon.stub(test._modulesMap, 'getRequiredModules').callsFake(name => ['test1', 'test2']);
      });

      afterEach(() => {
         stubTestList.restore();
         stubfs.restore();
      });

      it('should make a config files for each modules in confing', (done) => {
         const baseConfig = require('../testConfig.base.json');
         const configFiles = {};

         stubfs = sinon.stub(fs, 'outputFile').callsFake((fileName, config) => {
            configFiles[fileName] = JSON.parse(config);
         });

         test._makeTestConfig({ name: 'test1', path: 'test1.json' }).then(() => {
            chai.expect(configFiles).to.have.property('test1.json');

            const config = configFiles['test1.json'];

            Object.keys(baseConfig).forEach((key) => {
               chai.expect(config).to.have.property(key);
            });

            done();
         });
      });
   });

   describe('._startBrowserTest()', () => {
      let stubfsjson;
      let stubOutputFile;
      let stubModuleMapGet;

      beforeEach(() => {
         test.options.set('test', {
            unitInBrowser: true
         });

         stubfsjson = sinon.stub(fs, 'readJsonSync').callsFake(() => require('../testConfig.base.json'));
         stubModuleMapGet = sinon.stub(test._modulesMap, 'get').callsFake(name => ({ name: 'test1', testInBrowser: true }));
      });

      afterEach(() => {
         stubfsjson.restore();
         stubOutputFile.restore();
         stubModuleMapGet.restore();
      });

      it('should not run test if testinbrowser was false', () => {
         stubModuleMapGet.callsFake(name => ({ name: 'test2', testInBrowser: false }));
         stubOutputFile = sinon.stub(fs, 'outputFile').callsFake((path, config) => {
            throw new Error();
         });

         chai.expect(() => test._startBrowserTest('test2')).to.not.throw();
      });

      it('should run test', (done) => {
         stubOutputFile = sinon.stub(fs, 'outputFile').callsFake(() => undefined);
         stubExecute.callsFake((cmd) => {
            chai.expect(cmd).to.includes('--browser');
            done();
         });

         test._startBrowserTest('test');
      });

      it('should start test server', (done) => {
         const options = new Map([
            ['rc', 'rc-12'],
            ['store', ''],
            ['repositories', {
               test: {
                  unitInBrowser: true
               }
            }],
            ['workspace', ''],
            ['workDir', ''],
            ['resources', ''],
            ['server', true]
         ]);

         test = new Test({
            options
         });

         sinon.stub(test._modulesMap, 'get').callsFake(() => ({ name: 'test1', testInBrowser: true }));
         stubOutputFile = sinon.stub(fs, 'outputFileSync').callsFake(() => undefined);

         stubExecute.callsFake((cmd) => {
            chai.expect(cmd).to.includes('server.js');
            done();
            stubExecute.callsFake(() => undefined);
         });

         test._startBrowserTest('test');
      });

      it('should create test config for module', (done) => {
         stubOutputFile = sinon.stub(fs, 'outputFile').callsFake((path) => {
            chai.expect(path).to.includes('testModule');
            done();
         });
         stubExecute.callsFake(() => undefined);

         test._startBrowserTest('testModule');
      });
   });

   describe('.checkReport()', () => {
      let stubTestReports;
      let stubexistsSync;
      let stubOtput;

      it('should create report when it not exists', (done) => {
         stubTestReports = sinon.stub(test, '_testReports').value(['test', 'test1']);
         stubexistsSync = sinon.stub(fs, 'existsSync').callsFake((name) => {
            return name !== 'test1';
         });
         stubOtput = sinon.stub(fs, 'outputFileSync').callsFake((name, text) => {
            if (name.includes('test1')) {
               done();
            }
         });

         test.checkReport();
      });
      it('should not throw an error', () => {
         stubTestReports = sinon.stub(test, '_testReports').value(['test', 'test1']);
         stubexistsSync = sinon.stub(fs, 'existsSync').callsFake(name => true);

         chai.expect(() => {
            test.checkReport();
         }).to.not.throw();
      });
      afterEach(() => {
         stubTestReports.restore();
         stubexistsSync.restore();

         // tslint:disable-next-line:no-unused-expression
         stubOtput && stubOtput.restore();
      });
   });

   describe('.startTest()', () => {
      let stubmakeTestConfig;
      let stubstartBrowserTest;
      let stubtestList;
      let stubBuild;

      beforeEach(() => {
         stubmakeTestConfig = sinon.stub(test, '_makeTestConfig').callsFake(() => Promise.resolve());
         stubstartBrowserTest = sinon.stub(test, '_startBrowserTest').callsFake(() => Promise.resolve());
         stubBuild = sinon.stub(test._modulesMap, 'build').callsFake(() => {});
         stubtestList = sinon.stub(test._modulesMap, 'getRequiredModules').callsFake(() => ['engine']);
      });

      afterEach(() => {
         stubmakeTestConfig.restore();
         stubstartBrowserTest.restore();
         stubtestList.restore();
         stubBuild.restore();
      });

      it('should start test', () => {
         const commandsArray = [];

         stubExecute.callsFake((cmd) => {
            commandsArray.push(cmd);
            chai.expect(commandsArray).to.includes('node node_modules/saby-units/cli.js --isolated --report --config="./testConfig_engine.json"');
            return Promise.resolve();
         });
         sinon.stub(test, '_shouldTestModule').callsFake(() => true);

         return test._startTest();
      });
   });

   describe('.prepareReport()', () => {
      let stubRead;
      let stubWrite;
      let stubTestReports;
      let fsExistsSync;
      let stubTestError;
      let outputFileSync;

      beforeEach(() => {
         stubWrite = sinon.stub(xml, 'writeXmlFile').callsFake(() => undefined);
         stubTestError = sinon.stub(test, '_testErrors').value({});
         stubTestReports = sinon.stub(test, '_testReports').value(new Map([['test', {}], ['test1', {}]]));
         stubRead = sinon.stub(fs, 'readFileSync').callsFake(() => '<testsuite><testcase classname="test1"></testcase></testsuite>');
         fsExistsSync = sinon.stub(fs, 'existsSync').callsFake(() => true);
         outputFileSync = sinon.stub(fs, 'outputFileSync').callsFake(() => true);
      });

      afterEach(() => {
         stubWrite.restore();
         stubRead.restore();
         stubTestReports.restore();
         fsExistsSync.restore();
         stubTestError.restore();
         outputFileSync.restore();
      });

      it('should return all test', (done) => {
         stubWrite.callsFake((name, obj) => {
            if (obj.testsuite.testcase[0].$.classname === 'test.test1') {
               done();
               stubWrite.restore();
            }
         });

         test.prepareReport();
      });

      it('should make failure report if it is empty', (done) => {
         stubRead.callsFake(() => '<testsuite tests="1"></testsuite>');
         stubTestReports = sinon.stub(test._modulesMap, 'getTestModulesByRep').callsFake(() => ['test']);
         stubTestError.value({ test: ['error'] });
         stubWrite.callsFake((name, obj) => {
            if (obj.testsuite.testcase[0]) {
               chai.expect(obj.testsuite.testcase[0].failure).to.equal('error');
               done();
            }
         });

         test.prepareReport();
      });
   });

   describe('._shouldTestModule()', () => {
      let stubGet;
      let stubTestModules;

      beforeEach(() => {
         test.options.set('diff', new Map());
         stubGet = sinon.stub(test._modulesMap, 'get').callsFake(name => ({
            'test11': { name: 'test11', rep: 'test1', depends: ['test13'] },
            'test12': { name: 'test12', rep: 'test1', depends: [] },
            'test13': { name: 'test13', rep: 'test1', depends: [] }
         }[name]));
         stubTestModules = sinon.stub(test._modulesMap, 'getModulesByRep').callsFake(() => ['test11', 'test12', 'test13']);
      });

      afterEach(() => {
         test._diff = undefined;
         stubGet.restore();
         stubTestModules.restore();
      });

      it('should test module if it existed in diff', () => {
         test._diff = new Map([
            ['test1', [path.join('test11', 'test1.js')]]
         ]);

         chai.expect(test._shouldTestModule('test11')).to.be.true;
      });

      it('should test module if diff was empty', () => {
         chai.expect(test._shouldTestModule('test11')).to.be.true;
      });

      it('should not test module if it not existed in diff', () => {
         test._diff = new Map([
            ['test1', ['test13/1.js']]
         ]);

         chai.expect(test._shouldTestModule('test11')).to.be.false;
      });
   });

   describe('._getTestConfig()', function() {
      let stubRelative;
      let originalWorkDir;
      let originalWorkspace;
      let originalResources;
      let stubModuleMap;

      beforeEach(() => {
         test.options.set('workDir', '/application');
         test.options.set('workspace', '/application');
         test.options.set('resources', '');

         stubRelative = sinon.stub(path, 'relative').callsFake((p) => p);
      });

      afterEach(() => {
         test.only = false;

         test.options.set('workDir', originalWorkDir);
         test.options.set('workspace', originalWorkspace);
         test.options.set('resources', originalResources);

         stubModuleMap && stubModuleMap.restore();

         stubRelative.restore();
      })

      it('should return config', async() => {
         const cfg = await test._getTestConfig();
         const base = require('../testConfig.base.json');

         for (let prop of Object.keys(base)) {
            chai.expect(cfg).to.have.property(prop);
         }
      });

      it('should set relative path to nyc', async() => {
         const cfg = await test._getTestConfig('name');

         chai.expect('/application/artifacts/name').is.equal(cfg.nyc.reportDir);
         chai.expect(this._workDir).is.equal(cfg.nyc.root);
      });

      it('should filter modules from another repository', async() => {
         stubModuleMap = sinon.stub(test._modulesMap, '_modulesMap').value(
            new Map([
               ['test11', {name: 'test11', rep: 'test1', depends: ['test22']}],
               ['test22', {name: 'test44', rep: 'test2', depends: []}],
               ['test_test1', {name: 'test_test1', rep: 'test1', depends: ['test11'], unitTest: true}]
            ])
         );
         const cfg = await test._getTestConfig('test1', 'node', 'test_test1');

         chai.expect([ '/application/test11/**/*.js' ]).to.deep.equal(cfg.nyc.include);
      });

      it('should filter modules from another repository', async() => {
         stubModuleMap = sinon.stub(test._modulesMap, '_modulesMap').value(
            new Map([
               ['test11', {name: 'test11', rep: 'test1', depends: ['test22']}],
               ['test22', {name: 'test44', rep: 'test2', depends: []}],
               ['test_test1', {name: 'test_test1', rep: 'test1', depends: ['test11'], unitTest: true}],
            ])
         );
         const cfg = await test._getTestConfig('test1', 'node', 'test_test1');

         chai.expect([ '/application/test11/**/*.js' ]).to.deep.equal(cfg.nyc.include);
      });

      it('should not throw error when module not exists in modules map', async() => {
         test.only = true;
         stubModuleMap = sinon.stub(test._modulesMap, '_modulesMap').value(
            new Map([
               ['test11', {name: 'test11', rep: 'test1', depends: []}],
               ['test_test1', {name: 'test_test1', rep: 'test1', depends: ['test11', 'test33'], unitTest: true}],
            ])
         );
         const cfg = await test._getTestConfig('test1', 'node', 'test_test1');

         chai.expect([ '/application/test11/**/*.js' ]).to.deep.equal(cfg.nyc.include);
      });
   });

   describe('._setDiff()', function() {
      let spySetDiff;

      afterEach(() => {
         test.options.delete('diff');
         spySetDiff.restore();
      });

      it('shouldnt call setDiff if it disabled ', () => {
         test.options.set('diff', false);
         spySetDiff = sinon.stub(test, '_setDiffByRep').callsFake(() => Promise.reject());

         return test._setDiff();
      });

      it('should call setDiff if it enabled with argument test', (done) => {
         test.options.set('diff', true);
         spySetDiff = sinon.stub(test, '_setDiffByRep').callsFake(() => {
            done();
         });

         test._setDiff();
      });
   });

   describe('._executeBrowserTestCmd()', () => {
      it('should call _executeBrowserTestCmd twice', () => {
         const spy = sinon.spy(test, '_executeBrowserTestCmd');

         stubExecute.callsFake(() => {
            stubExecute.callsFake(() => Promise.resolve());
            return Promise.reject(['ECHROMEDRIVER']);
         });
         return test._executeBrowserTestCmd().then(() => {
            chai.expect(spy.calledTwice).to.be.true;
         });
      });

      it('should not infint calls itself', () => {
         const spy = sinon.spy(test, '_executeBrowserTestCmd');

         stubExecute.callsFake(() => {
            return Promise.reject(['ECHROMEDRIVER']);
         });

         return test._executeBrowserTestCmd().then(() => {
            chai.expect(5).to.be.equal(spy.callCount);
         });
      });
   });

   describe('_startNodeTest()', () => {
      let stubfsjson;
      let stubModuleMapGet;

      beforeEach(() => {
         test.options.set('test',  {});
         stubfsjson = sinon.stub(fs, 'readJsonSync').callsFake(() => require('../testConfig.base.json'));
         stubModuleMapGet = sinon.stub(test._modulesMap, 'get').callsFake(name => ({ name: 'test1', testInBrowser: true }));
      });

      afterEach(() => {
         test.options.delete('test');
         test.options.delete('grep');
         stubModuleMapGet.restore();
         stubfsjson.restore();
      });

      it('should run tests with grep', (done) => {
         test.options.set('grep', 'testgrep');
         stubSpawn.callsFake((cmd, args) => {
            chai.expect(args).to.includes('--grep=testgrep');
            done();
         });

         test._startNodeTest('test1');
      });
   });

   describe('._getErrorText()', () => {
      it('should prepare error text', () => {
         chai.expect('(node:) error').to.equal(test._getErrorText(' (node:123)     [error] '));
      });
   });

   it('should _shouldUpdateAllowedErrors is false', () => {
      chai.expect(test._shouldUpdateAllowedErrors).to.be.false;
   });
});
