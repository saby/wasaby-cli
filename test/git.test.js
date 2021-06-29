//tslint:disable:no-unused-expression
//tslint:disable:one-variable-per-declaration

const chai = require('chai');
const sinon = require('sinon');
const Git = require('../app/util/git');
const shell = require('../app/util/shell');
const fs = require('fs-extra');

let git;
let stubExecute;
let stubfsAppend;

describe('Git', () => {
    beforeEach(() => {
        stubExecute = sinon.stub(shell.prototype, 'execute').callsFake(() => {});
        stubfsAppend = sinon.stub(fs, 'appendFileSync').callsFake(() => undefined);
        git = new Git({
            rc: 'path/to',
            name: 'name',
        });
    });
    afterEach(() => {
        stubExecute.restore();
        stubfsAppend.restore();
    });
    describe('merge', () => {
        it('should call git merge', (done) => {
            stubExecute.callsFake((cmd) => {
                chai.expect(cmd).to.includes('merge');
                done();
                return Promise.resolve();
            });

            git.merge('test');
        });

        it('should abort merge if it failed', () => {
            let cmdArray = [];
            stubExecute.callsFake((cmd) => {
                if (cmd.includes('abort')) {
                    cmdArray.push(cmd);
                return Promise.resolve();
                }
                return Promise.reject();
            });

            return git.merge('test').catch(function () {
                chai.expect(cmdArray[0]).to.includes('merge --abort');
            });
        });

        it('should return origin error', () => {
            stubExecute.callsFake((cmd) => {
                if (cmd.includes('merge test')) {
                    const err = new Error('origin');
                    return Promise.reject(err);
                }
                return Promise.resolve();
            });

            return git.merge('test').catch(function (e) {
                chai.expect(e.message).to.equal("Конфликт при мерже 'test': Error: origin");
            });
        });
    });

    describe('getRcBranch()', () => {
        it('should return rc-21.2000', () => {
            chai.assert.strictEqual(Git.getRcBranch('21.2000/foo'), 'rc-21.2000');
        });

        it('should return undefined', () => {
            chai.assert.isUndefined(Git.getRcBranch('MyBranch/foo'));
        });
    })
});
