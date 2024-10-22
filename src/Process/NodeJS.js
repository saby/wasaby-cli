const ChildProcess = require('./ChildProcess');
const VersionController = require('./VersionController');

const versionController = new VersionController({
   lowerSupported: '16',
   topSupported: '18',
   name: 'Node.JS',
   envName: 'node',
   installLink: 'https://nodejs.org/ru/download/releases'
});

class NodeJS extends ChildProcess {
   constructor(cfg) {
      cfg.env = 'node';
      cfg.versionController = versionController;

      super(cfg);
   }

   static async checkSupport() {
      await versionController.checkSupport();
   }
}

module.exports = NodeJS;
