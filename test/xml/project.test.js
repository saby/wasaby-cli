const chai = require('chai');
const sinon = require('sinon');
const fs = require('fs-extra');
const xml = require('../../app/xml/xml');
const Project = require('../../app/xml/project');

let project;
let stubxml;
let stubxmlWrite;
describe('Project', () => {
   beforeEach(() => {
      stubxml = sinon.stub(xml, 'readXmlFile').callsFake(() => ({
         cloud: {
            $: {name: 'project'},
            items: [{service: [{$:{url:'./srv1.s3srv'}},{$:{url:'./srv2.s3srv'}}]}]
         }
      }));
      project = new Project({
         options: new Map([
            ['projectPath', '/path/to/project.s3cld']
         ])
      });

      const modulesMap = new Map([
         [
            'test11',
            {
               name: 'test11',
               rep: 'test1',
               forTests: true,
               s3mod: 'test11/test11.s3mod',
               id: '123'
            }
         ], [
            'test22',
            {
               name: 'test2',
               rep: 'test2',
               forTests: true,
               s3mod: 'test11/test22.s3mod',
               id: '321'
            }
         ]
      ]);

      modulesMap.getRequiredModules = () => {
         return ['test11','test22'];
      };
      modulesMap.getChildModules = () => {
         return ['test11','test22'];
      };

      sinon.stub(project, '_modulesMap').value(modulesMap);
      stubxmlWrite = sinon.stub(xml, 'writeXmlFile').callsFake(() => undefined);
   });

   afterEach(() => {
      stubxml.restore();
      stubxmlWrite.restore();
   });

   describe('.getName()', () => {
      it('should return project name', async() => {
         const name = await project.getName();

         chai.expect(name).to.equal('project');
      });
   });
   describe('.getServices()', () => {
      it('should return project services', async() => {
         const srv = await project.getServices();

         chai.expect(srv).to.deep.equal(['/path/to/srv1.s3srv', '/path/to/srv2.s3srv']);
      });
   });
   describe('.getDeploy()', () => {
      it('should return project deploy', async() => {
         const srv = await project.getDeploy();

         chai.expect(srv).to.equal('/path/to/project.s3deploy');
      });
   });
   describe('.prepareSrv()', () => {
      let stubExists;

      beforeEach(() => {
         stubxml.callsFake((path) => {
            if (path === 'test1.s3srv') {
               return {
                  service: {
                     items: [
                        {
                           ui_module: [
                              {
                                 $: {
                                    name: 'test11',
                                    url: 'url'
                                 }
                              }
                           ]
                        }
                     ],
                     parent: [
                        {
                           $: {
                              path: 'test2.s3srv'
                           }
                        }
                     ]
                  }
               };
            } else if (path === 'test2.s3srv') {
               return {
                  service: {
                     items: [
                        {
                           ui_module: [
                              {
                                 $: {
                                    name: 'test22',
                                    url: 'url'
                                 }
                              }
                           ]
                        }
                     ]
                  }
               };
            }
         });

         stubExists = sinon.stub(fs, 'existsSync').callsFake((name) => {
            return name.includes('test1.s3srv');
         });
      });

      it('should replace path to modules', (done) => {
         project._updateSrvModules('test1.s3srv');

         stubxmlWrite.callsFake((filePath, srv) => {
            chai.expect(srv.service.items[0].ui_module[0].$.url).to.include('test11.s3mod');
            done();
         });
      });

      it('should prepare parent s3srv', (done) => {
         stubExists.callsFake(() => true);
         project._updateSrvModules('test1.s3srv');

         stubxmlWrite.callsFake((filePath, srv) => {
            if (filePath.includes('test2.s3srv')) {
               chai.expect(srv.service.items[0].ui_module[0].$.url).to.include('test22.s3mod');
               done();
            }
         });
      });

      afterEach(() => {
         stubExists.restore();
      });
   });

   describe('._addModulesToSrv()', () => {
      const srv = {
         service: {
            items: [
               {
                  ui_module: [
                     {
                        $: {
                           name: 'test11',
                           url: 'url'
                        }
                     }
                  ]
               }
            ]
         }
      };

      beforeEach(() => {
         stubxml.callsFake((path) => srv);
      });

      it('should add modules to srv', async () => {
         await project._addModulesToSrv('path');
         chai.expect(3).to.equal(srv.service.items[0].ui_module.length);
      });

      it('should add dependencies for modules from srv', (done) => {
         project._modulesInSrv = ['testSrv'];
         project._addModulesToSrv('path');
         sinon.stub(project._modulesMap, 'getChildModules').callsFake((modules) => {
            chai.expect(modules).to.includes('testSrv');
            done();
            return [];
         });
      });
   });
});
