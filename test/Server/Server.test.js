const Server = require('../../src/Server/Server');

describe('Server', () => {
   describe('detectAvailablePort()', () => {
      test('should return available port', async() => {
         const testedPort = await Server.detectAvailablePort();

         expect(testedPort > 1023).toBeTruthy();
         expect(testedPort < 65536).toBeTruthy();
      });
   });
});
