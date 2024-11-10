const Version = require('../Utils/Version');
const ChildProcess = require('./ChildProcess');

const GET_VERSION = /\d+\.\d+\.\d+/;

const versionCache = new Map();

class VersionController {
   constructor(cfg) {
      this.lowerSupported = new Version(cfg.lowerSupported);
      this.topSupported = new Version(cfg.topSupported);
      this.name = cfg.name;
      this.envName = cfg.envName;
      this.installMsg = `You have to install latest version by mask ${this.topSupported}\n${cfg.installLink}`;
   }

   buildErrorMessage(msg) {
      return `${this.name} ${msg}.${this.installMsg}`;
   }

   async checkSupport() {
      const current = await this.get();

      if (this.lowerSupported.isNewer(current) || this.topSupported.isOlder(current)) {
         throw new Error(this.buildErrorMessage(`version ${current} not support`));
      }
   }

   async get() {
      if (versionCache.has(this.name)) {
         return versionCache.get(this.name);
      }

      const proc = new ChildProcess({
         commandLine: `${this.envName} --version`,
         silent: true
      });

      try {
         const [version] = await proc.run();
         const parseVersion = new Version(GET_VERSION.exec(version)[0]);

         versionCache.set(this.name, parseVersion);

         return parseVersion;
      } catch (err) {
         throw new Error(this.buildErrorMessage('version not available'));
      }
   }
}

module.exports = VersionController;
