const JestRunner = require('jest-runner').default;

class Runner extends JestRunner {
   constructor(globalConfig, context) {
      super(globalConfig, context);

      this.on('wasaby-cli-test-id', (result) => {
         process.send(result);
      });
   }
}

module.exports = Runner;
