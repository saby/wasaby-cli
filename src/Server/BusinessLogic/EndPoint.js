class EndPoint {
   constructor(url) {
      this.url = url;
      this.headers = {};
      this.protocol = 6;
   }

   SetHeader(name, value) {
      this.headers[name] = value;
   }

   SetProtocol(version) {
      this.protocol = version;
   }
}

module.exports = EndPoint;
