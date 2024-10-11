const ChildProcess = require('./ChildProcess');
const VersionController = require('./VersionController');

const ENV_NAME = process.platform === 'win32' ? 'python' : 'python3';
const versionController = new VersionController({
   lowerSupported: '3.11',
   topSupported: '3.11',
   name: 'Python',
   envName: ENV_NAME,
   installLink: 'https://www.python.org/downloads/'
});

class Python extends ChildProcess {
   constructor(cfg) {
      cfg.env = ENV_NAME;
      cfg.versionController = versionController;

      super(cfg);
   }
}

module.exports = Python;
