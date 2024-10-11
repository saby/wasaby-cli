const logger = require('../Utils/Logger');

class Static {
   constructor(root, enableBrowserCache) {
      this.root = root;
      this.cacheTime = enableBrowserCache ? 60 * 60 * 1000 : 0;
   }

   init(server, domain) {
      this.domain = domain;

      server.get('/**.*', (req, res) => {
         this.process(req, res);
      });
   }

   process(req, res) {
      logger.debug(`Process request for static file: ${req.url}`);

      const [url,] = req.url.split('?');

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
               logger.debug(`Error reading file: ${err}`);
            } else {
               logger.error(`Error reading file: ${err}`);
               res.sendStatus(404);
            }
         }
      });
   }
}

module.exports = Static;