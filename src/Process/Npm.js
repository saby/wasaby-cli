const ChildProcess = require('./ChildProcess');
const VersionController = require('./VersionController');

const versionController = new VersionController({
   lowerSupported: '8',
   topSupported: '11',
   name: 'npm',
   envName: 'npm',
   installLink: 'https://www.npmjs.com/package/npm?activeTab=versions'
});

class Npm extends ChildProcess {
   constructor(cfg) {
      cfg.env = 'npm';
      cfg.versionController = versionController;

      super(cfg);
   }
}

module.exports = Npm;
