const chai = require('chai');
const sinon = require('sinon');
const fs = require('fs-extra');
const Prepare = require('../app/prepare');

describe('Prepare', () => {
   let prepare;
   let writeJSON;
   let existsSync;

   beforeEach(() => {
      const options = new Map([
         ['repositories', {
            test1: {},
            test2: {}
         }],
         ['store',  'store'],
         ['rep', ['name']],
         ['resources', 'application']
      ]);

      prepare = new Prepare({
         options
      });

      writeJSON = sinon.stub(fs, 'writeJSON').callsFake(() => undefined);
      existsSync = sinon.stub(fs, 'existsSync').callsFake(() => undefined);
   });

   afterEach(() => {
      writeJSON.restore();
      existsSync.restore();
   });

   describe('_writeConfig', () => {
      it('should write config', (done) => {
         writeJSON.callsFake(() => {
            done();
         });

         Prepare.writeConfig('path/to/config');
      });

      it('should not rewrite config if it exists', () => {
         existsSync.callsFake(() => true);
         Prepare.writeConfig('path/to/config');
         chai.expect(writeJSON.notCalled).is.true;
      });
   });

   describe('_getPathFromConfig', () => {
      let readJSON;

      beforeEach(() => {
         readJSON = sinon.stub(fs, 'readJSON').callsFake(() => ({
            compilerOptions: {
               paths: {
                  module: ['path/to/module']
               }
            }
         }));
      });

      afterEach(() => {
         readJSON.restore();
      });

      it('should return paths', async () => {
         const paths = await prepare._getPathsFromConfig('path/to/config');

         chai.expect({module: ['path/to/module']}).to.deep.equal(paths);
      });
   });

   describe('_getPaths', () => {
      let modulesMapList;
      let modulesMapGet;

      beforeEach(() => {
         modulesMapList = sinon.stub(prepare._modulesMap, 'getChildModules').callsFake(() => (['testModule']));
         modulesMapGet = sinon.stub(prepare._modulesMap, 'get').callsFake(() => ({
            name: 'testModule',
            path: 'path/to/module'
         }));
      });

      afterEach(() => {
         modulesMapList.restore();
         modulesMapGet.restore();
      });

      it('should return paths', async () => {
         const paths = await prepare._getPaths();

         chai.expect(paths).to.have.property('testModule/*');
      });
   });


});
