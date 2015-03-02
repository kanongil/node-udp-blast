/* jshint node:true */

"use strict";

var Dgram = require('dgram'),
    Dns = require('dns'),
    Util = require('util');

var BufferList = require('bl'),
    Ipaddr = require('ipaddr.js'),
    Writable = require('readable-stream/writable');

function UdpBlast(dst, options) {
  dst = dst || 1234;

  if (typeof dst === 'number')
    dst = { port: dst, host: 'localhost' };

  dst.port = ~~dst.port;
  if (typeof dst.host !== 'string')
    throw new TypeError('host must be a string');

  options = options || {};

  Writable.call(this, { highWaterMark: options.highWaterMark });

  this.dst = {
    host: dst.host,
    port: ~~dst.port,
    address: null
  };
  this.ttl = ~~options.ttl;
  this.packetSize = ~~options.packetSize || 512;

  this.bl = new BufferList();
  this.client = null;

  this.on('finish', function() {
    var self = this;
    process.nextTick(function() {
      if (!self.client) // if we haven't even setup the client, just emit close
        return self.emit('close');

      // this delays the final processing until after the 'finish' callback has been emitted
      // should be ok'ish, as the Transform module does the same for async _flush()'es
      self._write(null, null, function() {
        self.client.close();
      });
    });
  });

  return this;
}
Util.inherits(UdpBlast, Writable);

UdpBlast.prototype._write = function(chunk, encoding, cb) {
  var bl = this.bl;
  var self = this;

  if (!this.client) {
    Dns.lookup(this.dst.host, function (err, address, family) {
      if (err) return cb(err);
      if (family !== 4 && family !== 6) return cb(new Error('unknown family: ' + family));

      self.dst.address = address;
      var addr = Ipaddr.parse(address);
      var mcast = (addr.range() === 'multicast');

      self.client = Dgram.createSocket(family === 6 ? 'udp6' : 'udp4');
      self.client.on('close', function() {
        self.emit('close');
      });

      self.client.bind(null, function(err) {
        if (err) return cb(err);

        if (!mcast) self.client.setBroadcast(true);

        if (self.ttl) {
          if (mcast)
            self.client.setMulticastTTL(self.ttl);
          else
            self.client.setTTL(self.ttl);
        }

        // try again
        self._write(chunk, encoding, cb);
      });
    });
    return;
  }

  if (chunk) bl.append(chunk);

  function sendnext(psize) {
    var len = bl.length;
    if (len >= psize) {
      self.client.send(bl.slice(0, psize), 0, psize, self.dst.port, self.dst.address, function(/*err, bytes*/) {
        // TODO: handle errors?
        bl.consume(psize);
        sendnext(psize);
      });
    } else if (len && !chunk) {
      // final packet
      sendnext(len);
    } else {
      cb();
    }
  }

  sendnext(this.packetSize);
};

module.exports = UdpBlast;
