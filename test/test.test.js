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
      test = new Test({
         rc: 'rc-12',
         store: '',
         reposConfig: {
            test1: {},
            test2: {}
         },
         workspace: '',
         workDir: '',
         resources: '',
         testRep: ['test1']
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
      let stubfs, stubTestList;
      beforeEach(() => {
         stubTestList = sinon.stub(test._modulesMap, 'getRequiredModules').callsFake(name => ['test1', 'test2']);
      });
      it('should make a config files for each modules in confing', (done) => {
         let baseConfig = require('../testConfig.base.json');
         let configFiles = {};
         stubfs = sinon.stub(fs, 'outputFile').callsFake((fileName, config) => {
            configFiles[fileName] = JSON.parse(config);
         });
         test._makeTestConfig({ name: 'test1', path: 'test1.json' }).then(() => {
            chai.expect(configFiles).to.have.property('test1.json');
            let config = configFiles['test1.json'];
            Object.keys(baseConfig).forEach((key) => {
               chai.expect(config).to.have.property(key);
            });
            done();
         });
      });
      afterEach(() => {
         stubTestList.restore();
         stubfs.restore();
      });
   });

   describe('._startBrowserTest()', () => {
      let stubcli, stubfsjson, stubOutputFile, stubModuleMapGet;
      beforeEach(() => {
         stubcli = sinon.stub(test._options, 'reposConfig').value({
            test: {
               unitInBrowser: true
            }
         });
         stubfsjson = sinon.stub(fs, 'readJsonSync').callsFake(() => require('../testConfig.base.json'));
         stubModuleMapGet = sinon.stub(test._modulesMap, 'get').callsFake(name => ({ name: 'test1', testInBrowser: true }));
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
         test = new Test({
            rc: 'rc-12',
            store: '',
            reposConfig: {
               test: {
                  unitInBrowser: true
               }
            },
            workspace: '',
            workDir: '',
            resources: '',
            server: true
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

      afterEach(() => {
         stubcli.restore();
         stubfsjson.restore();
         stubOutputFile.restore();
         stubModuleMapGet.restore();
      });
   });

   describe('.checkReport()', () => {
      let stubTestReports, stubexistsSync, stubOtput;
      it('should create report when it not exists', (done) => {
         stubTestReports = sinon.stub(test, '_testReports').value(['test', 'test1']);
         stubexistsSync = sinon.stub(fs, 'existsSync').callsFake((name) => {
            if (name === 'test1') {
               return false;
            }
            return true;
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
      let stubmakeTestConfig, stubstartBrowserTest, stubtestList, stubBuild;
      beforeEach(() => {
         stubmakeTestConfig = sinon.stub(test, '_makeTestConfig').callsFake(() => Promise.resolve());
         stubstartBrowserTest = sinon.stub(test, '_startBrowserTest').callsFake(() => Promise.resolve());
         stubBuild = sinon.stub(test._modulesMap, 'build').callsFake(() => {});
         stubtestList = sinon.stub(test._modulesMap, 'getRequiredModules').callsFake(() => ['engine']);
      });
      it('should start test', () => {
         let commandsArray = [];
         stubExecute.callsFake((cmd) => {
            commandsArray.push(cmd);
            chai.expect(commandsArray).to.includes('node node_modules/saby-units/cli.js --isolated --report --config="./testConfig_engine.json"');
            return Promise.resolve();
         });
         sinon.stub(test, '_shouldTestModule').callsFake(() => true);
         return test._startTest();
      });

      afterEach(() => {
         stubmakeTestConfig.restore();
         stubstartBrowserTest.restore();
         stubtestList.restore();
         stubBuild.restore();
      });
   });

   describe('.prepareReport()', () => {
      let stubRead, stubWrite, stubTestReports, fsExistsSync, stubTestError, outputFileSync;
      beforeEach(() => {
         stubWrite = sinon.stub(xml, 'writeXmlFile').callsFake(() => undefined);
         stubTestError = sinon.stub(test, '_testErrors').value({});
         stubTestReports = sinon.stub(test, '_testReports').value(new Map([['test', {}], ['test1', {}]]));
         stubRead = sinon.stub(fs, 'readFileSync').callsFake(() => '<testsuite><testcase classname="test1"></testcase></testsuite>');
         fsExistsSync = sinon.stub(fs, 'existsSync').callsFake(() => true);
         outputFileSync = sinon.stub(fs, 'outputFileSync').callsFake(() => true);
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

      afterEach(() => {
         stubWrite.restore();
         stubRead.restore();
         stubTestReports.restore();
         fsExistsSync.restore();
         stubTestError.restore();
         outputFileSync.restore();
      });
   });

   describe('._shouldTestModule()', () => {
      let stubDiff, stubGet, stubTestModules;
      beforeEach(() => {
         stubDiff = sinon.stub(test, '_diff').value(new Map());
         stubGet = sinon.stub(test._modulesMap, 'get').callsFake(name => ({
            'test11': { name: 'test11', rep: 'test1', depends: ['test13'] },
            'test12': { name: 'test12', rep: 'test1', depends: [] },
            'test13': { name: 'test13', rep: 'test1', depends: [] }
         }[name]));
         stubTestModules = sinon.stub(test._modulesMap, 'getModulesByRep').callsFake(() => ['test11', 'test12', 'test13']);
      });
      afterEach(() => {
         stubDiff.restore();
         stubGet.restore();
         stubTestModules.restore();
      });
      it('should test module if it existed in diff', () => {
         stubDiff.value(new Map([['test1', [path.join('test11', 'test1.js')]]]));
         chai.expect(test._shouldTestModule('test11')).to.be.true;
      });
      it('should test module if diff was empty', () => {
         chai.expect(test._shouldTestModule('test11')).to.be.true;
      });
      it('should not test module if it not existed in diff', () => {
         stubDiff.value(new Map([['test1', ['test13/1.js']]]));
         chai.expect(test._shouldTestModule('test11')).to.be.false;
      });
   });

   describe('._getTestConfig()', function() {
      beforeEach(() => {
         sinon.stub(test._options, 'workDir').value('/application');
         sinon.stub(test._options, 'workspace').value('/application');
      });
      it('should return config', async() => {
         let cfg = await test._getTestConfig();
         let base = require('../testConfig.base.json');
         for (let prop of Object.keys(base)) {
            chai.expect(cfg).to.have.property(prop);
         }
      });

      it('should set checkLeaks in config', async() => {
         test._options.chekLeaks = false;
         let cfg = await test._getTestConfig();
         chai.expect(cfg.ignoreLeaks).is.true;
      });

      it('should set relative path to nyc', async() => {
         let cfg = await test._getTestConfig('name');
         chai.expect('./artifacts/name').is.equal(cfg.nyc.reportDir);
         chai.expect(this._workDir).is.equal(cfg.nyc.root);
      });

      it('should filter modules from another repository', async() => {
         sinon.stub(test._modulesMap, '_modulesMap').value(
            new Map([
               ['test11', {name: 'test11', rep: 'test1', depends: ['test22']}],
               ['test22', {name: 'test44', rep: 'test2', depends: []}],
               ['test_test1', {name: 'test_test1', rep: 'test1', depends: ['test11'], unitTest: true}],
            ])
         );
         let cfg = await test._getTestConfig('test1', 'node', 'test_test1');
         chai.expect([ 'test11/**/*.js' ]).to.deep.equal(cfg.nyc.include);
      });

      it('should filter modules from another repository', async() => {
         sinon.stub(test._modulesMap, '_modulesMap').value(
            new Map([
               ['test11', {name: 'test11', rep: 'test1', depends: ['test22']}],
               ['test22', {name: 'test44', rep: 'test2', depends: []}],
               ['test_test1', {name: 'test_test1', rep: 'test1', depends: ['test11'], unitTest: true}],
            ])
         );
         let cfg = await test._getTestConfig('test1', 'node', 'test_test1');
         chai.expect([ 'test11/**/*.js' ]).to.deep.equal(cfg.nyc.include);
      });

      it('should not throw error when module not exists in modules map', async() => {
         sinon.stub(test._modulesMap, '_modulesMap').value(
            new Map([
               ['test11', {name: 'test11', rep: 'test1', depends: []}],
               ['test_test1', {name: 'test_test1', rep: 'test1', depends: ['test11', 'test33'], unitTest: true}],
            ])
         );
         let cfg = await test._getTestConfig('test1', 'node', 'test_test1');
         chai.expect([ 'test11/**/*.js' ]).to.deep.equal(cfg.nyc.include);
      });
   });

   describe('._setDiff()', function() {
      let spySetDiff;

      it('shouldnt call setDiff if it disabled ', () => {
         test._options.diff = false;
         spySetDiff = sinon.stub(test, '_setDiffByRep').callsFake(() => Promise.reject());
         return test._setDiff();
      });
      it('should call setDiff if it enabled with argument test', (done) => {
         test._options.diff = true;
         spySetDiff = sinon.stub(test, '_setDiffByRep').callsFake(() => {
            done();
         });
         test._setDiff();
      });
   });

   describe('._executeBrowserTestCmd()', () => {
      it('should call _executeBrowserTestCmd twice', () => {
         let spy = sinon.spy(test, '_executeBrowserTestCmd');
         stubExecute.callsFake(() => {
            stubExecute.callsFake(() => Promise.resolve());
            return Promise.reject(['ECHROMEDRIVER']);
         });
         test._executeBrowserTestCmd().then(() => {
            chai.expect(spy.calledTwice).to.be.true;
         });
      });
   });

   describe('_startNodeTest()', () => {
      let stubcli, stubfsjson, stubModuleMapGet;
      beforeEach(() => {
         stubcli = sinon.stub(test._options, 'reposConfig').value({
            test: {
            }
         });
         stubfsjson = sinon.stub(fs, 'readJsonSync').callsFake(() => require('../testConfig.base.json'));
         stubModuleMapGet = sinon.stub(test._modulesMap, 'get').callsFake(name => ({ name: 'test1', testInBrowser: true }));
      });
      it('should run tests with grep', (done) => {
         test._startNodeTest('test1');
         test._options.argvOptions = { grep: 'testgrep' };
         stubSpawn.callsFake((cmd, args) => {
            chai.expect(args).to.includes('--grep=testgrep');
            done();
         });
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
