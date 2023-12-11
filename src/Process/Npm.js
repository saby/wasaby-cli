const ChildProcess = require('./ChildProcess');
const VersionController = require('./VersionController');

const versionController = new VersionController({
   lowerSupported: '8',
   topSupported: '9',
   name: 'npm',
   envName: 'npm',
   installLink: 'https://www.npmjs.com/package/npm?activeTab=versions'
});

class Git extends ChildProcess {
   constructor(cfg) {
      cfg.env = 'npm';
      cfg.versionController = versionController;

      super(cfg);
   }
}

module.exports = Git;
