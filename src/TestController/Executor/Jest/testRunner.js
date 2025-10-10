'use strict';

const circusRunner = require('jest-circus/runner');

module.exports = async function(
   globalConfig,
   config,
   environment,
   runtime,
   testPath,
   sendMessageToJest
) {
   const status = {
      done: 0,
      fail: 0,
      skip: 0
   };

   environment.handleTestEvent = async(event) => {
      if (event.name === 'test_done') {
         ++status.done;
      }

      if (event.name === 'test_fn_failure') {
         ++status.fail;
      }

      if (event.name === 'test_skip') {
         ++status.skip;
      }

      if (event.name === 'run_finish') {
         if (!environment.global.testID) {
            return;
         }

         const result = {
            done: [],
            fail: [],
            skip: []
         };

         if (status.fail) {
            result.fail.push(environment.global.testID);
         } else if (status.skip) {
            result.skip.push(environment.global.testID);
         } else {
            result.done.push(environment.global.testID);
         }

         sendMessageToJest('wasaby-cli-test-id', result);
      }
   };

   return circusRunner(
      globalConfig,
      config,
      environment,
      runtime,
      testPath,
      sendMessageToJest
   );
};
