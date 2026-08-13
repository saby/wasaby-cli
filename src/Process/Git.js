const ChildProcess = require('./ChildProcess');
const VersionController = require('./VersionController');

const versionController = new VersionController({
   lowerSupported: '2.30',
   topSupported: '2',
   name: 'Git',
   envName: 'git',
   installLink: 'https://git-scm.com/downloads'
});

class Git extends ChildProcess {
   constructor(cfg) {
      cfg.env = 'git';
      cfg.versionController = versionController;
      cfg.assignmentOperator = ' ';
      cfg.envArgs = {
         ...cfg.envArgs,
         'no-pager': true
      };

      super(cfg);
   }

   buildArgs() {
      const params = this.buildParams();
      const options = this.buildOptions(this.options);

      return [...options, ...params];
   }
}

module.exports = Git;
