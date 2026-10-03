#!/usr/bin/env node
const childProcess = require('node:child_process');
const os = require('node:os');

const halfMemory = Math.floor((os.totalmem() * 0.75) / 1024 / 1024);

const child = childProcess.fork(require.resolve('wasaby-cli/cli'), [
   'runPreCommitHook'
], {
   cwd: '#ROOT_PROJECT#',
   execArgv: [
      `--max-old-space-size=${halfMemory}`,
   ],
   env: {
      ...process.env,
      NODE_OPTIONS: `--max-old-space-size=${halfMemory}`,
   }
});

child.on('exit', (code) => {
   if (code !== 0) {
      console.log('Command "git commit" was rejected. Pre-commit hook finished with errors. See console or debug.log to path "./wasaby-cli_artifacts/runPreCommitHook/debug.log"');
   }

   process.exit(code);
});
