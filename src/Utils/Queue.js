const logger = require('./Logger');

class Queue {
   constructor() {
      this.queue = [];
   }

   next() {
      const func = this.queue.shift();

      if (func) {
         logger.debug(`Starting next handler in queue. Queue size: ${this.queue.length}`);

         this.current = func;
         func();
      } else {
         logger.debug('Queue is empty.');
         this.current = undefined;
      }
   }

   push(func) {
      if (!this.current) {
         logger.debug('Queue is empty. Starting handler now');

         this.current = func;

         func();
      } else {
         this.queue.push(func);
         logger.debug(`Push handler in queue. Queue size: ${this.queue.length}`);
      }
   }
}

module.exports = Queue;