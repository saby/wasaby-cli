const logger = require('../Utils/Logger');

class Static {
   constructor(root, enableBrowserCache) {
      this.root = root;
      this.cacheTime = enableBrowserCache ? 60 * 60 * 1000 : 0;
   }

   init(server, domain, staticsHandler) {
      this.domain = domain;

      server.get(/\.[^/]*$/, this.getProcess(staticsHandler));
   }

   getProcess(staticsHandler) {
      if (staticsHandler) {
         return (req, res) => {
            logger.debug(`Process request for static file: ${req.url}`);

            staticsHandler(req, res, this.root, req.url.split('?')[0], this.sendFile.bind(this));
         };
      }

      return (req, res) => {
         logger.debug(`Process request for static file: ${req.url}`);

         this.sendFile(res, req.url.split('?')[0]);
      };
   }

   sendFile(res, url) {
      res.sendFile(url, {
         root: this.root,
         maxAge: this.cacheTime,
         immutable: true,
         lastModified: false,
         etag: false,
         headers: {
            Cache: 'HIT',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Origin': this.domain,
         }
      }, (err) => {
         if (err) {
            if (err.message.includes('Request aborted')) {
               logger.debug(`Error reading file by url ${url}: ${err}`);
            } else {
               logger.error(`Error reading file by url ${url}: ${err}`);
               res.sendStatus(404);
            }
         }
      });
   }
}

module.exports = Static;