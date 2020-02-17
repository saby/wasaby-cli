const chai = require('chai');
const sinon = require('sinon');
const fs = require('fs-extra');
const xml = require('../../app/xml/xml');
const Project = require('../../app/xml/project');

let project;
let stubxml;
describe('Project', () => {
   beforeEach(() => {
      stubxml = sinon.stub(xml, 'readXmlFile').callsFake(() => ({
         cloud: {
            $: {name: 'project'},
            items: [{service: [{$:{url:'./srv1.s3srv'}},{$:{url:'./srv2.s3srv'}}]}]
         }
      }));
      project = new Project({
         file: '/path/to/project.s3cld'
      });
   });

   afterEach(() => {
      stubxml.restore();
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
      let stubxmlRead;
      let stubxmlWrite;
      let stubExists;
      let buildMap;

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
         stubxmlWrite = sinon.stub(xml, 'writeXmlFile').callsFake(() => undefined);
         buildMap = sinon.stub(project, '_modulesMap').value(new Map([
            [
               'test11',
               {
                  name: 'test11',
                  rep: 'test1',
                  forTests: true,
                  s3mod: 'test11/test11.s3mod'
               }
            ], [
               'test22',
               {
                  name: 'test2',
                  rep: 'test2',
                  forTests: true,
                  s3mod: 'test11/test22.s3mod'
               }
            ]
         ]));
         stubExists = sinon.stub(fs, 'existsSync').callsFake((name) => {
            return name.includes('test1.s3srv');
         });
      });

      it('should replace path to modules', (done) => {
         project._prepareSrv('test1.s3srv');
         stubxmlWrite.callsFake((filePath, srv) => {
            chai.expect(srv.service.items[0].ui_module[0].$.url).to.include('test11.s3mod');
            done();
         });
      });

      it('should prepare parent s3srv', (done) => {
         stubExists.callsFake(() => true);
         project._prepareSrv('test1.s3srv');
         stubxmlWrite.callsFake((filePath, srv) => {
            if (filePath.includes('test2.s3srv')) {
               chai.expect(srv.service.items[0].ui_module[0].$.url).to.include('test22.s3mod');
               done();
            }
         });
      });

      afterEach(() => {
         stubxmlWrite.restore();
         stubExists.restore();
         buildMap.restore();
      });
   });
});
