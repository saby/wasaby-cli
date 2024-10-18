/**
 * Console logger implementation.
 */

const logger = console;

function extend(Child, Parent) {
   const Proxy = function() {};

   Proxy.prototype = Parent.prototype;
   Child.prototype = new Proxy();
   Child.prototype.constructor = Child;
   Child.superclass = Parent.prototype;
}

class Logger {
   log(tag, message) {
      logger.log(`[LOG] ${tag}': ${message}`);
   }

   warn(tag, message) {
      logger.warn(`[WARNING] ${tag}: ${message}`);
   }

   error(tag, message, exception) {
      logger.error(`[ERROR] ${tag}: ${message}${(exception && exception.stack ? ': ' + exception.stack : (exception ? ': ' + String(exception) : ''))}`);
   }

   info(tag, message) {
      logger.info(`[INFO] ${tag}: ${message}`);
   }
}

exports.Logger = Logger;

/**
 * Setups console logger
 */
function setup(requirejs) {
   if (requirejs.defined('Env/Env')) {
      const Env = requirejs('Env/Env');
      const IoC = Env.IoC;
      const ILogger = Env.ILogger;

      extend(Logger, ILogger);
      IoC.bindSingle('ILogger', new Logger());
   }
}

exports.setup = setup;
