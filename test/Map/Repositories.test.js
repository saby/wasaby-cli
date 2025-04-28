const RepositoriesMap = require('../../src/Map/Repositories');
const fs = require('fs-extra');

function getNamesRepositories(repositories) {
   const result = [];

   for (const repository of repositories) {
      result.push(repository.name);
   }

   return result;
}

describe('Repositories.js', () => {
   const repositories = {
      Repository1: {
         url: 'wasaby-cli',
         name: 'Repository1',
         dir: 'dir/Repository1'
      },
      Repository2: {
         url: 'wasaby-cli2',
         name: 'Repository2',
         dir: 'dir/Repository2'
      },
   };
   let repositoriesMap;
   let stubEnsureDirSync;

   beforeEach(() => {
      stubEnsureDirSync = jest.spyOn(fs, 'ensureDirSync').mockImplementation(() => true);

      repositoriesMap = new RepositoriesMap(repositories);
   });

   describe('constructor()', () => {
      test('should create empty map', () => {
         const repsMap = new RepositoriesMap();

         expect(repsMap.repositories.size).toStrictEqual(0);
      });

      test('should create map by passed repositories list', () => {
         const repsMap = new RepositoriesMap({
            Repository1: {
               url: 'wasaby-cli2',
               name: 'Repository1',
               dir: 'dir/Repository1'
            }
         });

         expect(repsMap.repositories.size).toStrictEqual(1);
         expect(repsMap.repositories.get('Repository1')).not.toBeUndefined();
         expect(repsMap.repositories.get('Repository1').name).toStrictEqual('Repository1');
      });
   });

   describe('get()', () => {
      test('should return repository if it is exists in map', () => {
         expect(repositoriesMap.get('Repository1')).not.toBeUndefined();
         expect(repositoriesMap.get('Repository1').name).toStrictEqual('Repository1');
      });

      test('should return undefined if it is not exists in map', () => {
         expect(repositoriesMap.get('RepositoryNotExists')).toBeUndefined();
      });
   });

   describe('has()', () => {
      test('should return true if it is exists in map', () => {
         expect(repositoriesMap.has('Repository1')).toBeTruthy();
      });

      test('should return false if it is not exists in map', () => {
         expect(repositoriesMap.get('RepositoryNotExists')).toBeFalsy();
      });
   });

   describe('add()', () => {
      test('should rewrite repository if it is exists in map', () => {
         expect(repositoriesMap.repositories.get('Repository1').dir).toStrictEqual('dir/Repository1');

         repositoriesMap.add({
            name: 'Repository1',
            dir: 'newDir/Repository1'
         });

         expect(repositoriesMap.repositories.get('Repository1')).not.toBeUndefined();
         expect(repositoriesMap.repositories.get('Repository1').dir).toStrictEqual('newDir/Repository1');
      });

      test('should add repository if it is not exists in map', () => {
         expect(repositoriesMap.repositories.has('NewRepository')).toBeFalsy();

         repositoriesMap.add({
            name: 'NewRepository',
            dir: 'dir/NewRepository'
         });

         expect(repositoriesMap.repositories.has('NewRepository')).toBeTruthy();
      });
   });

   describe('getRepositories()', () => {
      test('should return all repositories if arguments is not passed', () => {
         const testedResult = repositoriesMap.getRepositories();

         expect(testedResult.size).toStrictEqual(2);
         expect(getNamesRepositories(testedResult)).toEqual(['Repository1', 'Repository2']);
      });

      test('should return repositories list', () => {
         const testedResult = repositoriesMap.getRepositories(['Repository1']);

         expect(testedResult.size).toStrictEqual(1);
         expect(getNamesRepositories(testedResult)).toEqual(['Repository1']);
      });

      test('should return only exists repositories', () => {
         const testedResult = repositoriesMap.getRepositories(['Repository1', 'Repository3']);

         expect(testedResult.size).toStrictEqual(1);
         expect(getNamesRepositories(testedResult)).toEqual(['Repository1']);
      });
   });

   describe('filter()', () => {
      test('should return repository if condition is one and true', () => {
         const testedResult = repositoriesMap.filter({
            name: 'Repository1'
         });

         expect(testedResult.size).toStrictEqual(1);
         expect(getNamesRepositories(testedResult)).toEqual(['Repository1']);
      });

      test('should return repository if all conditions are true', () => {
         const testedResult = repositoriesMap.filter({
            name: 'Repository1',
            dir: 'dir/Repository1'
         });

         expect(testedResult.size).toStrictEqual(1);
         expect(getNamesRepositories(testedResult)).toEqual(['Repository1']);
      });

      test('should return empty list if one conditions are false', () => {
         const testedResult = repositoriesMap.filter({
            name: 'Repository1',
            dir: 'dir/Repository2'
         });

         expect(testedResult.size).toStrictEqual(0);
      });
   });

   describe('serialize()', () => {
      test('should return object', () => {
         const testedResult = repositoriesMap.serialize();

         expect(Object.keys(testedResult)).toEqual(Object.keys(repositories));
      });
   });
});
