'use strict';

const Dgram = require('node:dgram');
const Stream = require('node:stream');

const BufferList = require('bl');
const Code = require('@hapi/code');
const Lab = require('@hapi/lab');
const Proxyquire = require('proxyquire');


// Declare internals

const internals = {
    dnsStubs: {},
    dgramStubs: {}
};


// Test shortcuts

const lab = exports.lab = Lab.script();
const { describe, it, before, after } = lab;
const { expect } = Code;


const { UdpBlast } = Proxyquire('..', { 'node:dns': internals.dnsStubs, 'node:dgram': internals.dgramStubs });


describe('UdpBlast', () => {

    const ended = (stream) => {

        return new Promise((resolve, reject) => {

            stream.on('end', resolve);
            stream.on('close', resolve);
            stream.on('error', reject);
        });
    };

    describe('#constructor()', () => {

        it('accepts empty argument list', (done) => {

            expect(new UdpBlast()).to.be.an.instanceof(UdpBlast);
        });

        it('stores option properties', (done) => {

            expect(new UdpBlast(null, { ttl: 42 })).to.include({ ttl: 42 });
            expect(new UdpBlast(null, { packetSize: 42 })).to.include({ packetSize: 42 });
            expect(new UdpBlast(null, { highWaterMark: 42 })._writableState).to.include({ highWaterMark: 42 });
        });

        it('is a Stream', (done) => {

            expect(new UdpBlast()).to.be.an.instanceof(Stream);
        });

        it('handles port number destination', (done) => {

            expect(new UdpBlast(1234).dst).to.include({ host: 'localhost', port: 1234 });
        });

        it('throws on invalid destinations', (done) => {

            const create = function (dst) {

                return function () {

                    return new UdpBlast(dst);
                };
            };

            expect(create(true)).to.throw(TypeError);
            expect(create('localhost')).to.throw(TypeError);
            expect(create({})).to.throw(TypeError);
        });
    });

    describe('stream', () => {

        it('bails on non-existent addresses', async () => {

            const blaster = new UdpBlast({ host: 'this.does.not.exist', port: 1234 });

            new BufferList().append('test').pipe(blaster);

            await expect(ended(blaster)).to.reject(Error);
        });

        it('handles a multicast ipv4 address', async () => {

            const blaster = new UdpBlast({ host: '224.20.54.121', port: '1234' }, { ttl: 1 });
            new BufferList().append('test').pipe(blaster);
            await ended(blaster);
        });

        it('handles an ipv6 address', async () => {

            const blaster = new UdpBlast({ host: '127::1', port: 1234 });
            blaster.write('test');
            blaster.end();
            await ended(blaster);
        });

        it('server receives correct udp datagrams', async () => {

            const  server = Dgram.createSocket('udp4');

            const deferred = {};
            const promise = new Promise((resolve, reject) => {

                deferred.resolve = resolve;
                deferred.reject = reject;
            });

            server.bind(0, 'localhost', (err) => {

                expect(err).to.not.exist();

                const blaster = new UdpBlast({ host: server.address().address, port: server.address().port }, { packetSize: 4, ttl: 1 });
                expect(blaster).to.exist();

                const bl = new BufferList();
                bl.append('boring...').end();
                bl.pipe(blaster);

                let cnt = 0;
                server.on('message', (data) => {

                    const parts = ['bori', 'ng..', '.'];
                    expect(data.toString()).to.equal(parts[cnt]);
                    if (++cnt === 3) {
                        server.on('close', deferred.resolve);
                        server.close();
                    }
                });
            });

            await promise;
        });

        it('handles immediate end', async () => {

            const server = Dgram.createSocket('udp4');

            const deferred = {};
            const promise = new Promise((resolve, reject) => {

                deferred.resolve = resolve;
                deferred.reject = reject;
            });

            server.bind(0, 'localhost', (err) => {

                expect(err).to.not.exist();

                new UdpBlast({ host: server.address().address, port: server.address().port })
                    .on('error', deferred.reject)
                    .on('close', deferred.resolve)
                    .end();
            });

            await promise;
        });
    });

    describe('dns stubs', () => {

        before(() => {

            internals.dnsStubs.lookup = function (host, callback) {

                callback(null, 'abc.def', 16);
            };
        });

        after(() => {

            const dns = require('node:dns');

            internals.dnsStubs.lookup = dns.lookup.bind(dns);
        });

        it('bails on unknown families', async () => {

            const blaster = new UdpBlast();
            new BufferList().append('test').pipe(blaster);
            await expect(ended(blaster)).to.reject(Error);
        });
    });

    describe('dgram stubs', () => {

        before(() => {

            internals.dgramStubs.createSocket = function (...args) {

                const socket = Dgram.createSocket.apply(this, args);
                socket.bind = function (arg1, arg2, callback) {

                    if (typeof arg1 === 'function') {
                        callback = arg1;
                    }
                    else if (typeof arg2 === 'function') {
                        callback = arg2;
                    }

                    callback(new Error('unknown bind error'));
                };

                return socket;
            };
        });

        after(() => {

            internals.dgramStubs.createSocket = Dgram.createSocket.bind(Dgram);
        });

        it('bails on local bind errors', async () => {

            const blaster = new UdpBlast();
            new BufferList().append('test').pipe(blaster);
            await expect(ended(blaster)).to.reject(Error);
        });
    });
});
