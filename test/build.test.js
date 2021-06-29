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
      const options = new Map([
         ['rep', ['test1']],
         ['repositories', {
            test1: {},
            test2: {},
            'sbis3-ws': {}
         }],
         ['store', ''],
         ['workDir', ''],
         ['resources', ''],
         ['buildTools', 'builder'],
         ['workspace', 'application'],
         ['rc', 'rc-10.1000']
      ]);

      build = new Build({
         options
      });
      stubExecute = sinon.stub(Shell.prototype, 'execute').callsFake(() => undefined);
   });

   afterEach(() => {
      stubExecute.restore();
   });

   describe('._run', () => {
      it('should run builder', (done) => {
         const options = new Map([
            ['rep', ['test1']],
            ['repositories', {
               test1: {}
            }],
            ['store', ''],
            ['buildTools', 'builder']
         ]);
         const buildB = new Build({
            options
         });

         sinon.stub(buildB, '_modulesMap').value({build: () => undefined, getCDNModules:() => []});
         sinon.stub(buildB, '_tslibInstall').callsFake(() => undefined);
         sinon.stub(buildB, '_initWithBuilder').callsFake(() => {
            done();
         });

         buildB._run();
      });

      it('should run genie', (done) => {
         const options = new Map([
            ['rep', ['test1']],
            ['repositories', {
               test1: {}
            }],
            ['resources', ''],
            ['store', ''],
            ['buildTools', 'jinnee']
         ]);

         const buildG = new Build({
            options
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
               return name === 'test1' ? { rep: 'test1' } : { rep: 'test2' };
            },
            has: () => false
         });
      });

      it('should make builder config like base', () => {
         const baseConfig = require('../builderConfig.base.json');
         let tConfig = {};

         build._pathTocdn = '/cdn'

         stubfs.callsFake((fileName, config) => {
            tConfig = JSON.parse(config);
         });

         build._makeBuilderConfig();
         chai.expect(tConfig).to.deep.include(baseConfig);
      });

      it('should add staticserver if defined hot reload port', (done) => {
         stubfs.callsFake((fileName, config) => {
            config = JSON.parse(config);
            chai.expect(config.staticServer).to.equal('localhost:10777');
            done();
         });

         build._hotReloadPort = 10777;
         build._makeBuilderConfig();
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
         fsLink.callsFake((c) => {
            chai.expect(c).to.includes('tslib.js');
            done();
         });
         build._tslibInstall();
      });
   });

   describe('_initWithBuilder', () => {
      it('should start watcher', (done) => {
         build.options.set('watcher', true);
         build._initWithBuilder();

         stubExecute.callsFake((cmd) => {
            if (cmd.includes('buildOnChangeWatcher')) {
               done();
            }
         });
      });
   });

   describe('_startHotReloadServer()', () => {
      let stubExists;

      beforeEach(() => {
         stubExists = sinon.stub(fs, 'existsSync').callsFake(() => true);

         sinon.stub(build, '_modulesMap').value({
            get: (name) => {
               return name === 'HotReload' ? {path: 'path/to/HotReload'} : {};
            },
            has: (name) => name === 'HotReload'
         });
      });

      afterEach(() => {
         stubExists.restore();
      });

      it('should start hotreload server', (done) => {
         stubExecute.callsFake((cmd) => {
            chai.expect(cmd).to.include('HotReload');
            done();
         });

         sinon.stub(build, '_shouldStartHotReload').callsFake(() => true);
         build._startHotReloadServer();
      });

      it('should not start hotreload server', () => {
         build.options.set('watcher', false);
         build._startHotReloadServer();
         chai.expect(stubExecute.called).is.false;
      });

      it('should not start hotreload server when server not existis', () => {
         build.options.set('watcher', true);
         stubExists.callsFake(() => false);
         build._startHotReloadServer();
         chai.expect(stubExecute.called).is.false;
      });
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
         build.options.set('pathToJinnee', 'path/to/jinnee');

         stubExecute.callsFake((cmd, path) => {
            if (path === 'path/to/jinnee') {
               done();
            }
         });

         build._initWithJinnee();
      });
   });
});
