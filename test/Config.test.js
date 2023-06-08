const Config = require('../src/Utils/Config');

describe('Main Config', () => {
   let config;

   beforeEach(() => {
      config = new Config();
   });

   describe('readConsole', () => {
      test('without params', () => {
         config.readConsole(['commandName']);

         expect(config.consoleParams.size).toStrictEqual(0);
      });

      test('two params', () => {
         config.readConsole(['commandName', '--firstParam=value1', '--secondParam=value2']);

         expect(config.consoleParams.size).toStrictEqual(2);
         expect(config.consoleParams.get('firstParam')).toStrictEqual('value1');
         expect(config.consoleParams.get('secondParam')).toStrictEqual('value2');
      });

      test('parameter has not only letters', () => {
         config.readConsole(['commandName', '--param=value/1=!val']);

         expect(config.consoleParams.size).toStrictEqual(1);
         expect(config.consoleParams.get('param')).toStrictEqual('value/1=!val');
      });

      test('parameter has array', () => {
         config.readConsole(['commandName', '--modules=value1,value2']);

         expect(config.consoleParams.size).toStrictEqual(1);
         expect(config.consoleParams.get('modules')).toEqual(['value1', 'value2']);
      });

      test('parameter is flag', () => {
         config.readConsole(['commandName', '--flag']);

         expect(config.consoleParams.size).toStrictEqual(1);
         expect(config.consoleParams.get('flag')).toEqual(true);
      });

      test('parameter name has dot', () => {
         config.readConsole(['commandName', '--par.ms=value']);

         expect(config.consoleParams.size).toStrictEqual(1);
         expect(config.consoleParams.get('par.ms')).toEqual('value');
      });
   });
});
