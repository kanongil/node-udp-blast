/* jshint node:true */

'use strict';

const Dgram = require('dgram');


const Dns = require('dns');


const Util = require('util');

const BufferList = require('bl');


const Ipaddr = require('ipaddr.js');


const Writable = require('readable-stream/writable');

const UdpBlast = function (dst, options) {

    dst = dst || 1234;

    if (typeof dst === 'number') {
        dst = { port: dst, host: 'localhost' };
    }

    dst.port = ~~dst.port;
    if (typeof dst.host !== 'string') {
        throw new TypeError('host must be a string');
    }

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

    this.on('finish', function () {

        const self = this;
        process.nextTick(() => {

            if (!self.client) { // if we haven't even setup the client, just emit close
                return self.emit('close');
            }

            // this delays the final processing until after the 'finish' callback has been emitted
            // should be ok'ish, as the Transform module does the same for async _flush()'es
            self._write(null, null, () => {

                self.client.close();
            });
        });
    });

    return this;
};

Util.inherits(UdpBlast, Writable);

UdpBlast.prototype._write = function (chunk, encoding, cb) {

    const bl = this.bl;
    const self = this;

    if (!this.client) {
        Dns.lookup(this.dst.host, (err, address, family) => {

            if (err) {
                return cb(err);
            }

            if (family !== 4 && family !== 6) {
                return cb(new Error('unknown family: ' + family));
            }

            self.dst.address = address;
            const addr = Ipaddr.parse(address);
            const mcast = (addr.range() === 'multicast');

            self.client = Dgram.createSocket(family === 6 ? 'udp6' : 'udp4');
            self.client.on('close', () => {

                self.emit('close');
            });

            self.client.bind(null, (err) => {

                if (err) {
                    return cb(err);
                }

                if (!mcast) {
                    self.client.setBroadcast(true);
                }

                if (self.ttl) {
                    if (mcast) {
                        self.client.setMulticastTTL(self.ttl);
                    }
                    else {
                        self.client.setTTL(self.ttl);
                    }
                }

                // try again
                self._write(chunk, encoding, cb);
            });
        });

        return;
    }

    if (chunk) {
        bl.append(chunk);
    }

    const sendnext = function (psize) {

        const len = bl.length;
        if (len >= psize) {
            self.client.send(bl.slice(0, psize), 0, psize, self.dst.port, self.dst.address, (/*err, bytes*/) => {

                // TODO: handle errors?
                bl.consume(psize);
                sendnext(psize);
            });
        }
        else if (len && !chunk) {
            // final packet
            sendnext(len);
        }
        else {
            cb();
        }
    };

    sendnext(this.packetSize);
};

module.exports = UdpBlast;
