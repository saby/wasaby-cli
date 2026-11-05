const child_process = require('child_process');

const CMD = require('../src/Process/CMD');
const logger = require('../src/Utils/Logger');

const getProcess = () => ({
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

});

describe('CMD', () => {
   let cmd;
   let stubConsoleLog;
   let stubDebugConsoleLog;

   beforeEach(() => {
      cmd = new CMD();
      stubConsoleLog = jest.spyOn(logger, 'info').mockImplementation(() => {});
      stubDebugConsoleLog = jest.spyOn(logger, 'debug').mockImplementation(() => {});
   });

   afterEach(() => {
      stubConsoleLog.mockRestore();
      stubDebugConsoleLog.mockRestore();
   });

   describe('execute', () => {
      let stubExec;

      afterEach(() => {
         stubExec.mockRestore();
      });

      test('should execute command', (done) => {
         stubExec = jest.spyOn(child_process, 'exec').mockImplementation((cmd) => {
            const process = getProcess();

            setTimeout(() => {
               process.kill();
            });

            expect(cmd).toStrictEqual('help');
            done();

            return process;
         });

         cmd.execute('help');
      });

      test('should return resolved promise if command result is ok', (done) => {
         stubExec = jest.spyOn(child_process, 'exec').mockImplementation((cmd) => {
            const process = getProcess();

            setTimeout(() => {
               process.kill();
            });

            return process;
         });

         cmd.execute('help').then(() => {
            done();
         });
      });

      test('should return rejected promise if command result is fail', (done) => {
         stubExec = jest.spyOn(child_process, 'exec').mockImplementation((cmd) => {
            const process = getProcess();

            setTimeout(() => {
               process.kill(2);
            });

            return process;
         });

         cmd.execute('help').catch(() => {
            done();
         });
      });

      test('should return resolved promise if command result is fail and it need force', (done) => {
         stubExec = jest.spyOn(child_process, 'exec').mockImplementation((cmd) => {
            const process = getProcess();

            setTimeout(() => {
               process.kill(2);
            });

            return process;
         });

         cmd.execute('help', undefined, {
            force: true
         }).then(() => {
            done();
         });
      });

      test('should return rejected promise if process will be killed', (done) => {
         stubExec = jest.spyOn(child_process, 'exec').mockImplementation((cmd) => {
            const process = getProcess();
            process.withErrorKill = true;

            setTimeout(() => {
               process.kill();
            });

            return process;
         });

         cmd.execute('help').catch(() => {
            done();
         });
      });

      test('should log info', (done) => {
         stubExec = jest.spyOn(child_process, 'exec').mockImplementation((cmd) => {
            const process = getProcess();

            process.withErrorKill = true;

            setTimeout(() => {
               process.stdout.data('ttttt');
               process.kill();
            });

            return process;
         });

         stubConsoleLog.mockImplementation((log) => {
            expect(log).toStrictEqual('ttttt');
            done();
         });

         cmd.execute('help').catch(() => undefined);
      });

      test('should log error', (done) => {
         stubExec = jest.spyOn(child_process, 'exec').mockImplementation(() => {
            const process = getProcess();

            process.withErrorKill = true;
            setTimeout(() => {
               process.stderr.data('ttttt');
               process.kill();
            });

            return process;
         });

         stubConsoleLog.mockImplementation((log) => {
            expect(log).toStrictEqual('ttttt');
            done();
         });

         cmd.execute('help').catch(() => undefined);
      });

      test('should set path to cwd for child process', (done) => {
         stubExec = jest.spyOn(child_process, 'exec').mockImplementation((cmd, options) => {
            const process = getProcess();

            setTimeout(() => {
               process.kill();
            });

            expect(options.cwd).toStrictEqual(__dirname);
            done();

            return process;
         });

         cmd.execute('help', __dirname);
      });
   });
});
