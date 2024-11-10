const Repository = require('../Entities/Repository');

class Repositories {
   constructor(repositories) {
      this.repositories = new Map();

      if (repositories) {
         for (const repository of Object.values(repositories)) {
            this.repositories.set(repository.name, new Repository(repository));
         }
      }
   }

   get(name) {
      return this.repositories.get(name);
   }

   add(repository) {
      this.repositories.set(repository.name, repository);
   }

   has(name) {
      return this.repositories.has(name);
   }

   filter(conditions) {
      const repositories = new Set();

      for (const repository of this.repositories.values()) {
         if (this._conditionsDone(repository, conditions)) {
            repositories.add(repository);
         }
      }

      return repositories;
   }

   getRepositories(names) {
      if (!names) {
         return new Set([...this.repositories.values()]);
      }

      const repositories = new Set();

      for (const repositoryName of names) {
         const repository = this.repositories.get(repositoryName);

         if (!repository) {
            continue;
         }

         repositories.add(repository);
      }

      return repositories;
   }

   serialize() {
      const repositories = {};

      for (const [name, repository] of this.repositories) {
         repositories[name] = repository.serialize();
      }

      return repositories;
   }

   _conditionsDone(repository, conditions) {
      for (const [nameProperty, value] of Object.entries(conditions)) {
         if (repository[nameProperty] !== value) {
            return false;
         }
      }

      return true;
   }
}

module.exports = Repositories;
