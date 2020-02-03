const chai = require('chai');
const fsUtil = require('../../app/util/fs');
const sinon = require('sinon');
const path = require('path');

describe('fs', () => {
   describe('.relative()', () => {
      let stubPathAbsolute;
      beforeEach(() => {
         stubPathAbsolute = sinon.stub(path, 'isAbsolute').callsFake(() => true);
      });
      afterEach(() => {
         stubPathAbsolute.restore();
      });
      it('should return relative path', async() => {
         chai.expect(fsUtil.relative('/home/store/test1', '/home/store/test1/test12')).to.equal('test12');
      });
      it('should return relative path', async() => {
         chai.expect(fsUtil.relative('c:\\home\\store\\test1', 'd:\\home\\store\\test1\\test12')).to.equal('d:\\home\\store\\test1\\test12');
      });
   });
});