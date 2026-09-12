const pathUtils = require('./path');
const ChildProcess = require('../Process/ChildProcess');

const OS = process.platform === 'win32' ? 'win' : 'nix';
const cwd = OS === 'win' ? pathUtils.join(process.env.ProgramFiles, '7-Zip') : process.cwd();
const exeName = OS === 'win' ? '7z' : '7za';

async function add(to, from) {
   const proc = new ChildProcess({
      commandLine: `${exeName} a -tzip "${to}.zip" "${from}/*"`,
      procOptions: {
         cwd
      }
   });

   await proc.run();
}

module.exports = {
   add
};
