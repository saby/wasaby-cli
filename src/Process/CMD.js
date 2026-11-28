const ChildProcess = require('./ChildProcess');

// TODO Надо перевести файл Git.js на ChildProcess и удалить CMD.js
class CMD {
   execute(commandLine, path, params) {
      const execProc = new ChildProcess({
         commandLine,
         procOptions: {
            cwd: path
         },
         ...params
      });

      return execProc.run();
   }
}

module.exports = CMD;
