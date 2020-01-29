const chai = require('chai');
const sinon = require('sinon');
const path = require('path');
const fs = require('fs-extra');
const Sdk = require('../../app/util/sdk');

let sdk;
let stubExecute;
let stubSdk;
let stubExistsSync;
let stubStatSync;

describe('Sdk', () => {
   before(() => {
      process.env.SDK = process.env.SDK || '';
      process.env.SBISPlatformSDK_101000 = process.env.SBISPlatformSDK_101000 || '';
   });

   beforeEach(() => {
      sdk = new Sdk({
         rc: 'rc-10.1000',
         workspace: 'application'
      });
      stubExistsSync = sinon.stub(fs, 'existsSync').callsFake(() => true);
      stubExecute = sinon.stub(sdk._shell, 'execute').callsFake(() => []);
      stubStatSync = sinon.stub(fs, 'statSync').callsFake(() => {
         return {isFile: () => false};
      });
   });

   afterEach(() => {
      stubExecute.restore();
      stubExistsSync.restore();
      stubStatSync.restore();
   });

   describe('.getPathToJinnee()', () => {
      before(() => {
         stubSdk = sinon.stub(process.env, 'SBISPlatformSDK_101000').value('sdk');
      });
      after(() => {
         stubSdk.restore();
      });
      it('should return path to jinnee', async() => {
         chai.expect(await sdk.getPathToJinnee()).to.equal(path.join('sdk', 'tools', 'jinnee'));
      });

      it('should throw an error when jinnee not exists', (done) => {
         stubExistsSync.callsFake(() => false);
         sdk.getPathToJinnee().catch(() => {
            done();
         });
      });

      it('should unpack archive', (done) => {
         stubStatSync.callsFake(() => {
            return {isFile: () => true};
         });
         stubExecute.callsFake((cmd) => {
            chai.expect(cmd).to.includes(`7za x ${path.join('sdk', 'tools', 'jinnee')}`);
            done();
         });
         sdk.getPathToJinnee();
      });

      it('should return path to unpack archive', async () => {
         stubStatSync.callsFake(() => {
            return {isFile: () => true};
         });
         stubExecute.callsFake((cmd) => {
            chai.expect(cmd).to.includes(`7za x ${path.join('sdk', 'tools', 'jinnee')}`);
         });
         chai.expect(await sdk.getPathToJinnee()).to.equal(path.join('application', 'jinnee'));
      });
   });

   describe('getPathToSdk()', () => {
      afterEach(() => {
         stubSdk.restore();
      });

      it('should return sdk path from SDK', () => {
         stubSdk = sinon.stub(process.env, 'SDK').value('path/to/sdk');
         chai.expect(sdk.getPathToSdk()).to.equal('path/to/sdk');
      });

      it('should return sdk path from SDK with version', () => {
         stubSdk = sinon.stub(process.env, 'SBISPlatformSDK_101000').value('path/to/sdk');
         chai.expect(sdk.getPathToSdk()).to.equal('path/to/sdk');
      });

      it('should throw an error when path to sdk is empty', () => {
         stubSdk = sinon.stub(process.env, 'SBISPlatformSDK_101000').value('');
         chai.expect(() => sdk.getPathToSdk()).to.throw();
      });

      it('should throw an error when sdk is not exists', () => {
         stubSdk = sinon.stub(process.env, 'SBISPlatformSDK_101000').value('path/to/sdk');
         stubExistsSync.callsFake(() => false);
         chai.expect(() => sdk.getPathToSdk()).to.throw();
      });
   });

   describe('jinneeDeploy', () => {
      before(() => {
         stubSdk = sinon.stub(process.env, 'SBISPlatformSDK_101000').value('sdk');
      });
      after(() => {
         stubSdk.restore();
      });
      it('should call deploy', (done) => {
         stubExecute.callsFake((cmd) => {
            chai.expect(cmd).is.include('jinnee-utility');
            done();
         });
         sdk.jinneeDeploy();
      });
   });
});