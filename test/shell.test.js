const chai = require('chai');
const sinon = require('sinon');
const ShellUtil = require('../app/util/shell');
const shell = require('shelljs');
const logger = require('../app/util/logger');

let shellUtil;
let stubConsoleLog;
let getProcess = () => {
   return {
      on(prop, callback) {
         this[prop] = callback;
      },

      kill(result) {
         this.exit && this.exit(result);
         this.close && this.close(result);
      },

      stdout: {
         on(prop, callback) {
            this[prop] = callback;
         }
      },

      stderr: {
         on(prop, callback) {
            this[prop] = callback;
         }
      }

   }
};

describe('Shell', () => {
   beforeEach(() => {
      shellUtil = new ShellUtil();
      stubConsoleLog = sinon.stub(logger, 'log').callsFake((log) => {});
   });
   afterEach(() => {
      stubConsoleLog.restore();
   });
   describe('execute', () => {
      let stubExec;
      it('should execute command', (done) => {
         stubExec = sinon.stub(shell, 'exec').callsFake((cmd) => {
            let process = getProcess();
            setTimeout(() => {
               process.kill();
            });
            chai.expect(cmd).to.equal('cd path && help');
            done();
            return process;
         });
         shellUtil.execute('help', 'path');
      });

      it('should return resolved promise if command result is ok', (done) => {
         stubExec = sinon.stub(shell, 'exec').callsFake((cmd) => {
            let process = getProcess();
            setTimeout(() => {
               process.kill();
            });
            return process;
         });
         shellUtil.execute('help', 'path').then(() => {
            done();
         });
      });

      it('should return rejected promise if command result is fail', (done) => {
         stubExec = sinon.stub(shell, 'exec').callsFake((cmd) => {
            let process = getProcess();
            setTimeout(() => {
               process.kill(2);
            });
            return process;
         });
         shellUtil.execute('help', 'path').catch(() => {
            done();
         });
      });

      it('should return resolved promise if command result is fail and it need force', (done) => {
         stubExec = sinon.stub(shell, 'exec').callsFake((cmd) => {
            let process = getProcess();
            setTimeout(() => {
               process.kill(2);
            });
            return process;
         });
         shellUtil.execute('help', 'path', {
            force: true
         }).then(() => {
            done();
         });
      });

      it('should return rejected promise if process will be killed', (done) => {
         stubExec = sinon.stub(shell, 'exec').callsFake((cmd) => {
            let process = getProcess();
            process.withErrorKill = true;
            setTimeout(() => {
               process.kill();
            });
            return process;
         });
         shellUtil.execute('help', 'path').catch(() => {
            done();
         });
      });

      it('should return rejected promise if command result is fail and process name is defined', (done) => {
         stubExec = sinon.stub(shell, 'exec').callsFake((cmd) => {
            let process = getProcess();
            setTimeout(() => {
               process.kill(2);
            });
            return process;
         });
         shellUtil.execute('help', 'path', 'pocess name').catch(() => {
            done();
         });
      });

      it('should log info', (done) => {
         stubExec = sinon.stub(shell, 'exec').callsFake((cmd) => {
            let process = getProcess();
            process.withErrorKill = true;
            setTimeout(() => {
               process.stdout.data('ttttt');
               process.kill();
            });
            return process;
         });
         stubConsoleLog.callsFake((log) => {
            chai.expect(log).to.equal('ttttt');
            done();
         });
         shellUtil.execute('help', 'path');
      });

      it('should log error', (done) => {
         stubExec = sinon.stub(shell, 'exec').callsFake(() => {
            let process = getProcess();
            process.withErrorKill = true;
            setTimeout(() => {
               process.stderr.data('ttttt');
               process.kill();
            });
            return process;
         });
         stubConsoleLog.callsFake((log) => {
            chai.expect(log).to.equal('ttttt');
            done();
         });
         shellUtil.execute('help', 'path');
      });

      it('should throw error if stdout contents error label', (done) => {
         stubExec = sinon.stub(shell, 'exec').callsFake(() => {
            let process = getProcess();
            process.withErrorKill = true;
            setTimeout(() => {
               process.stdout.data('[error]: ttttt');
               process.kill();
            });
            return process;
         });

         shellUtil.execute('help', 'path', {errorLabel: '[error]:'}).catch(errors => {
            chai.expect(errors[0]).to.equal('[error]: ttttt');
            done();
         });
      });

      afterEach(()=> {
         stubExec.restore();
      })
   });

   describe('._closeChildProcess()', () => {
      it('should close all child process', (done) => {
         let stubcli = sinon.stub(shellUtil, '_childProcessMap').value([getProcess()]);

         shellUtil.closeChildProcess().then(() => {
            done();
         });

         stubcli.restore();
      });
   });

});
