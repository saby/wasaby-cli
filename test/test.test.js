const chai = require('chai');

const sinon = require('sinon');
const fs = require('fs-extra');
const Test = require('../app/test');
let xml = require('../app/xml/xml');
const shell = require('../app/util/shell');

let test;
let stubfsAppend;
let stubExecute;
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
      stubExecute = sinon.stub(shell.prototype, 'execute').callsFake(() => undefined);
   });
   afterEach(() => {
      stubExecute.restore();
      stubfsAppend.restore();
   });

   describe('._makeTestConfig()', () => {
      let stubfs, stubTestList;
      beforeEach(() => {
         stubTestList = sinon.stub(test._modulesMap, 'getTestList').callsFake((name) => {
            return ['test1', 'test2'];
         });
      });
      it('should make a config files for each modules in confing', (done) => {
         let baseConfig = require('../testConfig.base.json');
         let configFiles = {};
         stubfs = sinon.stub(fs, 'outputFile').callsFake((fileName, config) => {
            configFiles[fileName] = JSON.parse(config);
         });
         test._makeTestConfig({name:'test1', path: 'test1.json'}).then(() => {
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
         stubcli = sinon.stub(test, '_reposConfig').value({
            test: {
               unitInBrowser: true
            }
         });
         stubfsjson = sinon.stub(fs, 'readJsonSync').callsFake(() => {
            return require('../testConfig.base.json');
         });
         stubModuleMapGet = sinon.stub(test._modulesMap, 'get').callsFake((name) => {
            return {name: 'test1', testInBrowser: true};
         });
      });

      it('shouldnt start test if it node only', () => {
         stubOutputFile = sinon.stub(fs, 'outputFile').callsFake(() => {
            throw new Error();
         });
         stubcli = sinon.stub(test, '_reposConfig').value({
            test: {
               unitInBrowser: false
            }
         });

         chai.expect(() => test._startBrowserTest('test')).to.not.throw();
      });

      it('should not run test if testinbrowser was false', () => {
         stubModuleMapGet.callsFake((name) => {
            return { name: 'test2', testInBrowser: false };
         });
         stubOutputFile = sinon.stub(fs, 'outputFile').callsFake((path, config) => {
            throw new Error();
         });
         chai.expect(() => test._startBrowserTest('test2')).to.not.throw()
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
         sinon.stub(test._modulesMap, 'get').callsFake(() => {
            return {name: 'test1', testInBrowser: true};
         });
         stubOutputFile = sinon.stub(fs, 'outputFileSync').callsFake(() => undefined);
         stubExecute.callsFake((cmd) => {
            chai.expect(cmd).to.includes('server.js');
            done();
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
            chai.expect(name).to.includes('test1');
            done();
         });
         test.checkReport();
      });
      it('should not throw an error', () => {
         stubTestReports = sinon.stub(test, '_testReports').value(['test', 'test1']);
         stubexistsSync = sinon.stub(fs, 'existsSync').callsFake((name) => {
            return true;
         });

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
         stubmakeTestConfig = sinon.stub(test, '_makeTestConfig').callsFake(() => {
            return Promise.resolve();
         });
         stubstartBrowserTest = sinon.stub(test, '_startBrowserTest').callsFake(() => {
            return Promise.resolve();
         });
         stubBuild = sinon.stub(test._modulesMap, 'build').callsFake(() => {});
         stubtestList = sinon.stub(test._modulesMap, 'getTestList').callsFake(() => ['engine']);
      });
      it('should start test', (done) => {
         let commandsArray = [];
         stubExecute.callsFake((cmd) => {
            commandsArray.push(cmd);
            chai.expect(commandsArray).to.includes('node node_modules/saby-units/cli.js --isolated --report --config="./testConfig_engine.json"');
            return Promise.resolve();
         });
         sinon.stub(test, '_shouldTestModule').callsFake(() => true);
         test._startTest().then(() => {
            done();
         });
      });

      afterEach(() => {
         stubmakeTestConfig.restore();
         stubstartBrowserTest.restore();
         stubtestList.restore();
         stubBuild.restore();
      });
   });

   describe('.prepareReport()', () => {
      let stubRead, stubWrite, stubTestReports, fsExistsSync, stubTestError;
      beforeEach(() => {
         stubWrite = sinon.stub(xml, 'writeXmlFile').callsFake(() => undefined);
         stubTestError = sinon.stub(test, '_testErrors').value({});
         stubTestReports = sinon.stub(test, '_testReports').value(new Map([['test', {}], ['test1', {}]]));
         stubRead = sinon.stub(fs, 'readFileSync').callsFake(() => {
            return '<testsuite><testcase classname="test1"></testcase></testsuite>';
         });
         fsExistsSync = sinon.stub(fs, 'existsSync').callsFake(() => true);
      });

      it('should return all test', (done) => {
         stubWrite.callsFake((name, obj) => {
            if (obj.testsuite.testcase[0].$.classname === '[test]: test1') {
               done();
            }
         });
         test.prepareReport();
      });

      it('should make failure report if it is empty', (done) => {
         stubRead.callsFake(() => '<testsuite tests="1"></testsuite>');
         stubTestReports = sinon.stub(test._modulesMap, 'getTestModules').callsFake(() => ['test']);
         stubTestError.value({test: ['error']});
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
      });
   });

   describe('._shouldTestModule()', () => {
      let stubDiff, stubGet, stubTestModules;
      beforeEach(() => {
         stubDiff = sinon.stub(test, '_diff').value(new Map());
         stubGet = sinon.stub(test._modulesMap, 'get').callsFake((name) => {
            return {
                'test11': {name: 'test11', rep: 'test1', depends: ['test13']},
                'test12': {name: 'test12', rep: 'test1', depends: []},
                'test13': {name: 'test13', rep: 'test1', depends: []}
            }[name];
         });
         stubTestModules = sinon.stub(test._modulesMap, 'getTestModules').callsFake(() => ['test11', 'test12', 'test13']);
      });
      afterEach(() => {
         stubDiff.restore();
         stubGet.restore();
         stubTestModules.restore();
      });
      it('should test module if it existed in diff', () => {
         stubDiff.value(new Map([['test1', ['test11/test1.js']]]));
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

   describe('._getTestConfig()', function () {
      it('should return config' , async () => {
         let cfg = await test._getTestConfig();
         let base = require('../testConfig.base.json');
         for (let prop of Object.keys(base)) {
            chai.expect(cfg).to.have.property(prop);
         }
      });

      it('should set checkLeaks in config' , async () => {
         sinon.stub(test, '_ignoreLeaks').value(true);
         let cfg = await test._getTestConfig();
         chai.expect(cfg.ignoreLeaks).is.true;
      });
   });
   describe('._setDiff()', function () {
      let spySetDiff;
      beforeEach(() => {
         spySetDiff = sinon.spy(test, '_setDiffByRep');
      });
      it('shouldnt call setDiff if it disabled ', () => {
         sinon.stub(test, '_isUseDiff').value(false);
         test._setDiff();
         chai.expect(spySetDiff.notCalled).to.be.true;
      });
      it('shouldnt call setDiff if it disabled ', () => {
         sinon.stub(test, '_isUseDiff').value(true);
         test._setDiff();
         chai.expect(spySetDiff.calledWith('test1')).to.be.true;
      });
   });
});
