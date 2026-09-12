const openssl = require('openssl-nodejs');

openssl('openssl req -x509 -nodes -days 700 -newkey rsa:2048 -keyout cert.key -out cert.crt -config req.cnf -sha256');
