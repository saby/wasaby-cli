const chai = require('chai');
const sinon = require('sinon');
const fs = require('fs-extra');
const path = require('path');
const ModulesMap = require('../app/util/modulesMap');
const xml = require('../app/xml/xml');

let modulesMap;
let stubfsAppend;
describe('modulesMap', () => {
   beforeEach(() => {
      modulesMap = new ModulesMap({
         reposConfig: {
            test1: {},
            test2: {}
         },
         store: ''
      });
      stubfsAppend = sinon.stub(fs, 'appendFileSync').callsFake(() => undefined);
   });
   afterEach(() => {
      stubfsAppend.restore();
   });
   describe('._findModulesInStore()', () => {
      let stubfs, stubStat, stubExists;
      beforeEach(() => {
         stubfs = sinon.stub(fs, 'readdirSync').callsFake((path) => {
            if (path.includes('tttModule')) {
               return ['ttt.txt', 'ttt.s3mod'];
            }
            return ['tttModule'];
         });
         stubExists = sinon.stub(fs, 'existsSync').callsFake(() => true);
         stubStat = sinon.stub(fs, 'lstatSync').callsFake((path) => {
            return {
               isDirectory: () => /.*tttModule$/.test(path),
               isSymbolicLink: () => false
            };
         });
      });
      it('should find all modules in repository', () => {
         return chai.expect(modulesMap._findModulesInStore('test1')).to.deep.equal([
            {
               s3mod: path.join('test1', 'tttModule', 'ttt.s3mod'),
               name: 'tttModule',
               path:  path.join('test1', 'tttModule'),
               rep: 'test1'
            },
            {
               s3mod: path.join('test2', 'tttModule', 'ttt.s3mod'),
               name: 'tttModule',
               path: path.join('test2', 'tttModule'),
               rep: 'test2'
            }
         ]);
      });
      afterEach(() => {
         stubfs.restore();
         stubStat.restore();
         stubExists.restore();
      });
   });

   describe('.getRequiredModules()', () => {
      let stubrepos, stubTestRep, stubModulesMap;
      beforeEach(() => {
         stubrepos = sinon.stub(modulesMap, '_reposConfig').value({
            test1: {
               test: 'path'
            },
            test2: {
               test: 'path'
            },
            test3: {}
         });

         stubModulesMap = sinon.stub(modulesMap, '_modulesMap').value(
            new Map([
               ['test11', {name: 'test11', rep: 'test1', depends: ['test22']}],
               ['test22', {name: 'test22', rep: 'test2', depends: []}],
               ['test33', {name: 'test33', rep: 'test3', depends: []}],
               ['test44', {name: 'test44', rep: 'test4', depends: ['test22', 'test11']}],
               ['test_test1', {name: 'test_test1', rep: 'test1', depends: ['test11'], unitTest: true}],
               ['test_test2', {name: 'test_test2', rep: 'test2', depends: ['test22'], unitTest: true}],
               ['test_test3', {name: 'test_test3', rep: 'test3', depends: ['test33'], unitTest: true}],
               ['test_test4', {name: 'test_test4', rep: 'test4', depends: ['test44'], unitTest: true}],
            ])
         );
      });
      it('should return all test', () => {
         stubTestRep = sinon.stub(modulesMap, '_testRep').value(['all']);
         chai.expect(modulesMap.getRequiredModules()).to.deep.equal(['test_test1', 'test_test2', 'test_test3', 'test_test4']);
      });

      it('should return test list for test1', () => {
         stubTestRep = sinon.stub(modulesMap, '_testRep').value(['test1']);
         chai.expect(modulesMap.getRequiredModules()).to.deep.equal(['test_test1', 'test_test4']);
      });

      it('should return test list for test with depends', () => {
         stubTestRep = sinon.stub(modulesMap, '_testRep').value(['test2']);
         chai.expect(modulesMap.getRequiredModules()).to.deep.equal(['test_test2', 'test_test1', 'test_test4']);
      });

      it('should return test2 only', () => {
         sinon.stub(modulesMap, '_only').value(true);
         stubTestRep = sinon.stub(modulesMap, '_testRep').value(['test2']);
         chai.expect(modulesMap.getRequiredModules()).to.deep.equal(['test22','test_test2']);
      });

      it('should return test list if check two unliked tests', () => {
         stubTestRep = sinon.stub(modulesMap, '_testRep').value(['test4', 'test3']);
         chai.expect(modulesMap.getRequiredModules()).to.deep.equal(['test_test4', 'test_test3']);
      });

      it('should return ', () => {
         stubTestRep = sinon.stub(modulesMap, '_testRep').value(['test4']);
         chai.expect(modulesMap.getRequiredModules()).to.deep.equal(['test_test4']);
      });

      afterEach(() => {
         stubrepos.restore();
         stubTestRep.restore();
         stubModulesMap.restore();
      });
   });

   describe('_getParentModules()', () => {
      let stubModulesMap;
      beforeEach(() => {
         stubModulesMap = sinon.stub(modulesMap, '_modulesMap').value(
            new Map([['test11', {
               name: 'test11',
               rep: 'test1',
               depends: ['test22'],
               forTests: true
            }], ['test22', {name: 'test22', rep: 'test2', depends: [], forTests: true}]])
         );
      });

      it('should return modules for test1 and test2', () => {
         chai.expect(modulesMap.getParentModules(['test22'])).to.deep.equal(['test22', 'test11']);
      });

      it('should return modules for test1', () => {
         chai.expect(modulesMap.getParentModules(['test11'])).to.deep.equal(['test11']);
      });

      afterEach(() => {
         stubModulesMap.restore();
      });
   });

   describe('_loadMap()', () => {
      let fsRead;
      const mapObj = {
         test11: {name: 'test11', rep: 'test1', depends: [], path: 'test1', s3mod: 'test11'}
      };

      beforeEach(() => {
         fsRead = sinon.stub(fs, 'readJSON').callsFake(() => mapObj);
      });

      it('should load map', () => {
         return modulesMap._loadMap().then(() => {
            chai.expect(mapObj.test11).to.deep.equal(modulesMap.get('test11'));
         });
      });

      it('should not replace existed values', () => {
         const cfg = {'path': 'test1'};
         modulesMap.set('test11', {...cfg});
         return modulesMap._loadMap().then(() => {
            chai.expect(cfg).to.deep.equal(modulesMap.get('test11'));
         });
      });

      afterEach(() => {
         fsRead.restore();
      });
   });


   describe('_saveMap()', () => {
      let fsExists, fsWrite, fsRead;
      const mapObj = {
         test21: {name: 'test21', rep: 'test2', depends: [], path: 'test2', s3mod: 'test21'}
      };
      const test11 = {name: 'test11', rep: 'test1', depends: [], path: 'test1', s3mod: 'test11'};
      beforeEach(() => {
         sinon.stub(modulesMap, '_modulesMap').value(new Map([
            ['test11', test11]
         ]));
         fsExists = sinon.stub(fs, 'existsSync').callsFake(() => false);
         fsRead = sinon.stub(fs, 'readJSON').callsFake(() => mapObj);
         fsWrite = sinon.stub(fs, 'writeJSON').callsFake(() => undefined);
      });

      it('should save map', (done) => {
         fsWrite.callsFake((file, object) => {
            chai.expect(object.test11).to.deep.equal(test11);
            done();
         });
         modulesMap._saveMap();
      });

      it('should merge current map and map that have been existsted in file', (done) => {
         fsWrite.callsFake((file, object) => {
            chai.expect(object.test11).to.deep.equal(test11);
            chai.expect(object.test21).to.deep.equal(mapObj.test21);
            done();
         });
         fsExists.callsFake(() => true);
         modulesMap._saveMap();
      });

      afterEach(() => {
         fsExists.restore();
         fsWrite.restore();
         fsRead.restore();
      });
   });

   describe(' _getChildModules()', () => {
      let stubModulesMap;
      beforeEach(() => {
         stubModulesMap = sinon.stub(modulesMap, '_modulesMap').value(
            new Map([
               ['test11', {name: 'test11', rep: 'test1', depends: ['test22']}],
               ['test22', {name: 'test22', rep: 'test2', depends: ['test33']}],
               ['test33', {name: 'test33', rep: 'test3', depends: []}]
            ])
         );
      });

      it('should return modules for test2 and test3', () => {
         modulesMap.getChildModules(['test22']);
         chai.expect(modulesMap.getChildModules(['test22'])).to.deep.equal(['test22', 'test33']);
      });

      it('should return modules for test1', () => {
         chai.expect(modulesMap.getChildModules(['test11'])).to.deep.equal(['test11', 'test22', 'test33']);
      });

      it('should return modules if it have recursive traverse', () => {
         stubModulesMap.value(
            new Map([
               ['test11', {name: 'test11', rep: 'test1', depends: ['test22']}],
               ['test22', {name: 'test22', rep: 'test2', depends: ['test33']}],
               ['test33', {name: 'test33', rep: 'test3', depends: ['test44']}],
               ['test44', {name: 'test44', rep: 'test4', depends: ['test11']}]
            ])
         );
         chai.expect(modulesMap.getChildModules(['test11'])).to.deep.equal(['test11', 'test22', 'test33', 'test44']);
      });

      afterEach(() => {
         stubModulesMap.restore();
      });
   });

   describe('._addToModulesMap()', () => {
      let stubXml;
      beforeEach(() => {
         stubXml = sinon.stub(xml, 'readXmlFile').callsFake(() => Promise.resolve({
            ui_module: {
               $: {
                  id: 'qweqwe123',
                  required: true
               },
               depends: [{
                  ui_module:[
                     {
                        $: {
                           name: 'test11'
                        }
                     }
                  ]
               }],
               unit_test: [{
                  $:{}
               }],
               name: 'qweqwe123'
            }
         }));
      });
      afterEach(() => {
         stubXml.restore();
      });
      it('should add module', async () => {
         await modulesMap._addToModulesMap([{
            name: 'qweqwe123',
            rep: 'test1',
         }]);
         chai.expect('qweqwe123').to.equal(modulesMap.get('qweqwe123').id)
         chai.expect(modulesMap.get('qweqwe123').required).is.true;
         chai.expect(['test11']).to.deep.equal(modulesMap.get('qweqwe123').depends);
      });
      it('should add module with for_cdn', async () => {
         stubXml.callsFake(() => Promise.resolve({
            ui_module: {
               $: {
                  id: 'qweqwe123',
                  for_cdn: '1'
               },
               name: 'qweqwe123'
            }
         }));
         await modulesMap._addToModulesMap([{
            name: 'qweqwe123',
            rep: 'test1',
         }]);
         chai.expect(modulesMap.get('qweqwe123').forCDN).is.true;
      })
   });


   describe('getModulesByRep', () => {
      beforeEach(() => {
         sinon.stub(modulesMap, '_modulesMap').value(
            new Map([
               ['test11', {name: 'test11', rep: 'test1', depends: ['test22']}],
               ['test22', {name: 'test22', rep: 'test2', depends: ['test33']}],
               ['test33', {name: 'test33', rep: 'test3', depends: []}]
            ])
         );
      });

      it('should return modules for test1 ', () => {
         chai.expect(modulesMap.getModulesByRep('test1')).to.deep.equal(['test11']);
      });
   });

   describe('getCDNModules()', () => {
      beforeEach(() => {
         sinon.stub(modulesMap, '_modulesMap').value(
             new Map([
                ['test11', {name: 'test11', rep: 'test1', forCDN: true}],
                ['test33', {name: 'test33', rep: 'test3', depends: []}]
             ])
         );
      });
      it('should return cdn modules', () => {
         chai.expect(['test11']).to.deep.equal(modulesMap.getCDNModules());
      });
   });

   describe('getTestModulesByRep', () => {
      beforeEach(() => {
         sinon.stub(modulesMap, '_modulesMap').value(
            new Map([
               ['test11', {name: 'test11', rep: 'test1', depends: ['test12'], unitTest: true}],
               ['test12', {name: 'test12', rep: 'test1', depends: []}],
               ['test21', {name: 'test21', rep: 'test2', depends: []}]
            ])
         );
      });

      it('should return test modules for test1', () => {
         chai.expect(modulesMap.getTestModulesByRep('test1')).to.deep.equal(['test11']);
      });

      it('should return empty array for test2', () => {
         chai.expect(modulesMap.getTestModulesByRep('test2')).to.deep.equal([]);
      });
   });

   describe('.getRequiredRepositories()', () => {
      let stubrep;
      beforeEach(() => {
         sinon.stub(modulesMap, '_reposConfig').value({
            test1: {
               test: 'path'
            },
            test2: {
               test: 'path'
            },
            test3: {}
         });

         sinon.stub(modulesMap, '_modulesMap').value(
            new Map([
               ['test11', {name: 'test11', rep: 'test1', depends: ['test12'], unitTest: true}],
               ['test12', {name: 'test12', rep: 'test1', depends: []}],
               ['test21', {name: 'test21', rep: 'test2', depends: ['test25']}]
            ])
         );

         stubrep = sinon.stub(modulesMap, '_testRep').value(['test1']);
      });

      it('should return required repositories', () => {
         chai.expect(new Set(['cdn', 'test1'])).to.deep.equal(modulesMap.getRequiredRepositories());
      });

      it('should not throw error when depend doesnt exists in map', () => {
         stubrep.value(['test2']);
         chai.expect(() => { modulesMap.getRequiredRepositories()}).not.throw();
      });
   });
});
