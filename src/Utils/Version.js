class Version {
   constructor(version) {
      const [major, minor, hotfix] = version.split('.');

      this.major = major && +major;
      this.minor = minor && +minor;
      this.hotfix = hotfix && +hotfix;
   }

   toString() {
      return `${this.major}.${this.minor || 'x'}.${this.hotfix || 'x'}`;
   }

   isOlder(version) {
      const unitNames = ['major', 'minor', 'hotfix'];

      for (const unitName of unitNames) {
         if (this[unitName] === version[unitName]) {
            continue;
         }

         return this[unitName] ? this[unitName] < version[unitName] : false;
      }

      return true;
   }

   isNewer(version) {
      const unitNames = ['major', 'minor', 'hotfix'];

      for (const unitName of unitNames) {
         if (this[unitName] === version[unitName]) {
            continue;
         }

         return this[unitName] ? this[unitName] > version[unitName] : false;
      }

      return true;
   }
}

module.exports = Version;
