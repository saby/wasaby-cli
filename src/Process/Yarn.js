const ChildProcess = require('./ChildProcess');
const VersionController = require('./VersionController');

const versionController = new VersionController({
   lowerSupported: '1.22',
   topSupported: '1.22',
   name: 'yarn',
   envName: 'yarn',
   installLink: 'https://www.npmjs.com/package/yarn?activeTab=versions'
});

class Yarn extends ChildProcess {
   constructor(cfg) {
      cfg.env = 'yarn';
      cfg.versionController = versionController;

      super(cfg);
   }
}

module.exports = Yarn;
