const chai = require('chai');
const sinon = require('sinon');
const fs = require('fs-extra');
const Build = require('../app/build');
const Project = require('../app/xml/project');
const Shell = require('../app/util/shell');


let build;

describe('Build', () => {
   let stubExecute;

   before(() => {
      process.env.SDK = process.env.SDK || '';
      process.env.SBISPlatformSDK_101000 = process.env.SBISPlatformSDK_101000 || '';
   });

   beforeEach(() => {
      build = new Build({
         testRep: ['test1'],
         reposConfig: {
            test1: {},
            test2: {},
            'sbis3-ws': {}
         },
         store: '',
         workDir: '',
         workspace: 'application',
         rc: 'rc-10.1000'
      });
      stubExecute = sinon.stub(Shell.prototype, 'execute').callsFake(() => undefined);
   });

   afterEach(() => {
      stubExecute.restore();
   });

   describe('._run', () => {
      it('should run builder', (done) => {
         let buildB = new Build({
            testRep: ['test1'],
            reposConfig: {
               test1: {}
            },
            store: '',
            buildTools: 'builder'
         });
         sinon.stub(buildB, '_modulesMap').value({build: () => undefined, getCDNModules:() => []});
         sinon.stub(buildB, '_tslibInstall').callsFake(() => undefined);
         sinon.stub(buildB, '_initWithBuilder').callsFake(() => {
            done();
         });
         buildB._run();
      });
      it('should run genie', (done) => {
         let buildG = new Build({
            testRep: ['test1'],
            reposConfig: {
               test1: {}
            },
            store: '',
            buildTools: 'jinnee'
         });
         sinon.stub(buildG, '_modulesMap').value({build: () => undefined, getCDNModules:() => []});
         sinon.stub(buildG, '_tslibInstall').callsFake(() => undefined);
         sinon.stub(buildG, '_initWithJinnee').callsFake(() => {
            done();
         });
         buildG._run();
      });
   });
   describe('._makeBuilderConfig()', () => {
      let stubfs;
      beforeEach(() => {
         stubfs = sinon.stub(fs, 'outputFile').callsFake(() => undefined);
         sinon.stub(build, '_modulesMap').value({
            getRequiredModules: () => {
               return ['test1', 'test2'];
            },
            getChildModules: () => {
               return [];
            },
            get: (name) => {
               return name === 'test1' ? {rep: 'test1'} : {rep: 'test2'};
            },
            has: () => false
         });
      });
      it('should make builder config like base', (done) => {
         let baseConfig = require('../builderConfig.base.json');
         stubfs.callsFake((fileName, config) => {
            config = JSON.parse(config);
            chai.expect(config).to.deep.include(baseConfig);
            done();
         });

         build._makeBuilderConfig(baseConfig.output);
      });

      afterEach(() => {
         stubfs.restore();
      });
   });

   describe('._tslibInstall()', () => {
      let fsLink;
      beforeEach(() => {
         fsLink = sinon.stub(fs, 'symlink');
         sinon.stub(build, '_modulesMap').value({get: () => ({path: 'path/to/test'})});
      });
      afterEach(() => {
         fsLink.restore();
      });
      it('should copy ts config', (done) => {
         let cmd;
         fsLink.callsFake((c) => {
            chai.expect(c).to.includes('tslib.js');
            done();
         });
         build._tslibInstall();
      });
   });

   describe('_initWithBuilder', () => {
      it('should start watcher', (done) => {
         build._watcher = true;
         build._initWithBuilder();
         stubExecute.callsFake((cmd) => {
            if (cmd.includes('buildOnChangeWatcher')) {
               done();
            }
         })
      })
   });

   describe('._initWithJinnee()', () => {
      let stubProjectSrv, stubProjectDeploy, stubSdk, stubExists, stubstatSync;
      beforeEach(() => {
         stubProjectSrv = sinon.stub(Project.prototype, 'prepare').callsFake(() => []);
         stubProjectDeploy = sinon.stub(Project.prototype, 'getDeploy').callsFake(() => {});
         stubSdk = sinon.stub(process.env, 'SBISPlatformSDK_101000').value('path/to/sdk');
         stubExists = sinon.stub(fs, 'existsSync').callsFake(() => true);
         stubstatSync = sinon.stub(fs, 'statSync').callsFake(() => ({isFile: () => false}));
      });
      afterEach(() => {
         stubProjectSrv.restore();
         stubProjectDeploy.restore();
         stubSdk.restore();
         stubExists.restore();
         stubstatSync.restore();
      });

      it('should run jinnee from pathToJinnee', (done) => {
         sinon.stub(build, '_pathToJinnee').value('path/to/jinnee');
         stubExecute.callsFake((cmd, path) => {
            if (path === 'path/to/jinnee') {
               done();
            }
         });
         build._initWithJinnee();
      });
   });


});
