const chai = require('chai');
const Cli = require('./../cli');
const sinon = require('sinon');
const fs = require('fs-extra');
let cli;
let stubArgv;
let stubfs;
describe('CLI', () => {
   beforeEach(() => {
      stubArgv = sinon.stub(process, 'argv').value(['', '', '--rep=types', '--branch=200/feature', '--rc=rc-200']);
      stubArgv = sinon.stub(process, 'argv').value(['', '', '--rep=types', '--branch=200/feature', '--rc=rc-200']);
      stubfs = sinon.stub(fs, 'writeFileSync').callsFake(() => {});
      cli = new Cli();
   });

   afterEach(() => {
      stubArgv.restore();
      stubfs.restore();
   });

   describe('.constructor()', () => {
      it('should trim repository name', () => {
         stubArgv = stubArgv.value(['', '', '--rep=saby-types, sbis3-controls', '--branch=200/feature', '--rc=rc-200']);
         cli = new Cli();
         chai.expect(cli.config.params.get('rep')).to.deep.equal(['saby-types', 'sbis3-controls']);
      });
   });

});
