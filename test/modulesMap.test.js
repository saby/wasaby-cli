const chai = require('chai');
const sinon = require('sinon');
const fs = require('fs-extra');
const path = require('path');
const ModulesMap = require('../app/util/modulesMap');
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
      let stubfs, stubStat;
      beforeEach(() => {
         stubfs = sinon.stub(fs, 'readdirSync').callsFake((path) => {
            if (path.includes('tttModule')) {
               return ['ttt.txt', 'ttt.s3mod'];
            }
            return ['tttModule'];
         });

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
      });
   });

   describe('.getModulesByRep()', () => {
      let stubFind;
      beforeEach(() => {
         stubFind = sinon.stub(modulesMap, '_modulesMap').value(new Map([['test11', {name: 'test11', rep: 'test1'}]]));

      });
      it('should concat modules from config and repository', () => {
         return chai.expect(modulesMap.getModulesByRep('test1')).to.deep.equal(['test11']);
      });
      afterEach(() => {
         stubFind.restore();
      });
   });

   describe('._getTestList()', () => {
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
         stubModulesMap = sinon.stub(modulesMap, '_testModulesMap').value(new Map([
            ['test1', ['test11']],
            ['test2', ['test22']],
            ['test3', ['test33']]
         ]));
         stubModulesMap = sinon.stub(modulesMap, '_modulesMap').value(
            new Map([
               ['test11', {name: 'test11', rep: 'test1', depends: ['test22'], forTests: true}],
               ['test22', {name: 'test22', rep: 'test2', depends: [], forTests: true}],
               ['test33', {name: 'test33', rep: 'test3', depends: [], forTests: true}],
               ['test_test1', {name: 'test_test1', rep: 'test1', depends: ['test11']}],
               ['test_test2', {name: 'test_test2', rep: 'test2', depends: ['test22']}],
               ['test_test3', {name: 'test_test3', rep: 'test3', depends: ['test33']}]
            ])
         );
         sinon.stub(modulesMap, '_testModulesMap').value(
            new Map([
               ['test1', ['test_test1']],
               ['test2', ['test_test2']],
               ['test3', ['test_test3']]
            ])
         );
      });
      it('should return all test', () => {
         stubTestRep = sinon.stub(modulesMap, '_testRep').value(['all']);
         chai.expect(modulesMap.getTestList()).to.deep.equal(['test_test1', 'test_test2', 'test_test3']);
      });

      it('should return test list for test1', () => {
         stubTestRep = sinon.stub(modulesMap, '_testRep').value(['test1']);
         chai.expect(modulesMap.getTestList()).to.deep.equal(['test_test1']);
      });

      it('should return test list for test with depends', () => {
         stubTestRep = sinon.stub(modulesMap, '_testRep').value(['test2']);
         chai.expect(modulesMap.getTestList()).to.deep.equal(['test_test2', 'test_test1']);
      });

      it('should return test2 only', () => {
         sinon.stub(modulesMap, '_only').value(true);
         stubTestRep = sinon.stub(modulesMap, '_testRep').value(['test2']);
         chai.expect(modulesMap.getTestList()).to.deep.equal(['test_test2']);
      });

      it('should return test list if check two unliked tests', () => {
         stubTestRep = sinon.stub(modulesMap, '_testRep').value(['test1', 'test3']);
         chai.expect(modulesMap.getTestList()).to.deep.equal(['test_test1', 'test_test3']);
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

   describe('_markModulesForTest()',() => {
      let stubModulesMap;
      let stubTestModulesMap;
      beforeEach(() => {
         stubModulesMap = sinon.stub(modulesMap, '_modulesMap').value(
             new Map([
                ['testModule', {name: 'testModule', rep: 'test1', depends: ['justModule']}],
                ['justModule', {name: 'justModule', rep: 'test1', depends: []}],
                ['independedModule', {name: 'independedModule', rep: 'test1', depends: []}]
             ])
         );
         stubTestModulesMap = sinon.stub(modulesMap, '_testModulesMap').value(new Map([
            ['test1', ['testModule']]
         ]));
      });

      it('should mark module as for test', () => {
         modulesMap._markModulesForTest();
         chai.expect(modulesMap.get('justModule').forTests).to.be.true;
      });


      it('should not mark module as for test when module has not been depended on test module', () => {
         modulesMap._markModulesForTest();
         chai.expect(modulesMap.get('independedModule').forTests).to.be.undefined;
      });

      it('should mark module test module', () => {
         modulesMap._markModulesForTest();
         chai.expect(modulesMap.get('testModule').forTests).to.be.true;
      });

      afterEach(() => {
         stubModulesMap.restore();
         stubTestModulesMap.restore();
      });
   });
});
