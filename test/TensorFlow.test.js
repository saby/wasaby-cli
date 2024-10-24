const tensorFlow = require('../src/Utils/tensorFlow');
const Repository = require('../src/Entities/Repository');
const fs = require("fs-extra");

describe('tensorFlow', () => {
   describe('getRcBranch()', () => {
      test('should return rc-21.2000', () => {
         expect(tensorFlow.getRcBranch('21.2000/foo')).toStrictEqual('rc-21.2000');
      });

      test('should return undefined', () => {
         expect(tensorFlow.getRcBranch('MyBranch/foo')).toBeUndefined();
      });
   });

   describe('isRcBranch()', () => {
      test('should return true for rc branch', () => {
         expect(tensorFlow.isRcBranch('rc-22.1000')).toBeTruthy();
      });

      test('should return false if branch is not rc', () => {
         expect(tensorFlow.isRcBranch('MyBranch/foo')).toBeFalsy();
      });
   });

   describe('getNearestRcBranch()', () => {
      let repository;
      let stubBranch;

      beforeEach(() => {
         jest.spyOn(fs, 'ensureDirSync').mockImplementation(() => true);

         repository = new Repository({
            url: 'url/rep',
            name: 'rep',
            dir: 'dir'
         });
         stubBranch = jest.spyOn(repository, 'getRemoteBranches').mockImplementation((branch) => {
            if (branch === 'rc-21.1*') {
               return [
                  'rc-21.1000',
                  'rc-21.1100'
               ];
            }

            if (branch === 'rc-22.1*') {
               return [
                  'rc-22.1000',
                  'rc-22.1100',
                  'rc-22.1110',
                  'rc-22.1200'
               ];
            }

            if (branch === 'rc-23.1*') {
               return [
                  'rc-23.1100'
               ];
            }

            return [];
         });
      });

      afterEach(() => {
         stubBranch.mockRestore();
      });

      test('should return passed branch if it was to branches list', async() => {
         expect(await tensorFlow.getNearestRcBranch('rc-22.1000', repository)).toStrictEqual('rc-22.1000');
      });

      test('should return exception if it not was minor to branches list', async() => {
         expect.assertions(1);

         try {
            await tensorFlow.getNearestRcBranch('rc-21.5000', repository);
         } catch (err) {
            expect(err.message).toStrictEqual('Repository url/rep hasn\'t branches are starting with "rc-21.5*"');
         }
      });

      test('should return branch is up minor', async() => {
         expect(await tensorFlow.getNearestRcBranch('rc-23.1000', repository)).toStrictEqual('rc-23.1100');
      });

      test('should return branch is down minor', async() => {
         expect(await tensorFlow.getNearestRcBranch('rc-22.1300', repository)).toStrictEqual('rc-22.1200');
         expect(await tensorFlow.getNearestRcBranch('rc-22.1102', repository)).toStrictEqual('rc-22.1100');
      });
   });
});
