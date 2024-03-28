#!/usr/bin/env node
const childProcess = require('node:child_process');

const child = childProcess.fork(require.resolve('wasaby-cli/cli'), [
   'runPreCommitHook'
], {
   cwd: '#ROOT_PROJECT#'
});

child.on('exit', (code) => {
   if (code !== 0) {
      console.log('Command "git commit" was rejected. Pre-commit hook finished with errors. See console or debug.log to path "./wasaby-cli_artifacts/runPreCommitHook/debug.log"');
   }

   process.exit(code);
});
