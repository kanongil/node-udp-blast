'use strict';

const Dgram = require('node:dgram');
const Dns = require('node:dns');
const { Writable } = require('node:stream');

const BufferList = require('bl');
const Ipaddr = require('ipaddr.js');


exports.UdpBlast = class extends Writable {

    constructor(dst, options) {

        dst = dst || 1234;

        if (typeof dst === 'number') {
            dst = { port: dst, host: 'localhost' };
        }

        dst.port = ~~dst.port;
        if (typeof dst.host !== 'string') {
            throw new TypeError('host must be a string');
        }

        options = options || {};

        super({ highWaterMark: options.highWaterMark });

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

            process.nextTick(() => {

                if (!this.client) { // if we haven't even setup the client, just emit close
                    return this.emit('close');
                }

                // this delays the final processing until after the 'finish' callback has been emitted
                // should be ok'ish, as the Transform module does the same for async _flush()'es
                this._write(null, null, () => {

                    this.client.close();
                });
            });
        });

        return this;
    }

    _write(chunk, encoding, next) {

        const bl = this.bl;

        if (!this.client) {
            Dns.lookup(this.dst.host, (err, address, family) => {

                if (err) {
                    return next(err);
                }

                if (family !== 4 && family !== 6) {
                    return next(new Error('unknown family: ' + family));
                }

                this.dst.address = address;
                const addr = Ipaddr.parse(address);
                const mcast = (addr.range() === 'multicast');

                this.client = Dgram.createSocket(family === 6 ? 'udp6' : 'udp4');
                this.client.on('close', () => {

                    this.emit('close');
                });

                this.client.bind(null, (err) => {

                    if (err) {
                        return next(err);
                    }

                    if (!mcast) {
                        this.client.setBroadcast(true);
                    }

                    if (this.ttl) {
                        if (mcast) {
                            this.client.setMulticastTTL(this.ttl);
                        }
                        else {
                            this.client.setTTL(this.ttl);
                        }
                    }

                    // try again
                    this._write(chunk, encoding, next);
                });
            });

            return;
        }

        if (chunk) {
            bl.append(chunk);
        }

        const sendnext = (psize) => {

            const len = bl.length;
            if (len >= psize) {
                this.client.send(bl.slice(0, psize), 0, psize, this.dst.port, this.dst.address, (/*err, bytes*/) => {

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
                next();
            }
        };

        sendnext(this.packetSize);
    }
};
