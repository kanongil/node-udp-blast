/* jshint node:true */

var Code = require('code'),
  Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.describe, it = lab.it;
var before = lab.before, after = lab.after;
var expect = Code.expect;

var Dgram = require('dgram'),
    Stream = require('stream');
var BufferList = require('bl');

var Proxyquire = require('proxyquire')

var dnsStubs = {}, dgramStubs = {};
var UdpBlast = Proxyquire('../udpblast', { dns: dnsStubs, dgram: dgramStubs });

describe('UdpBlast', function(){

  describe('#new', function(){

    it('accepts empty argument list', function(done){
      expect(new UdpBlast).to.be.an.instanceof(UdpBlast);
      done();
    })

    it('stores option properties', function(done) {
      expect(new UdpBlast(null, { ttl: 42 })).to.include({ ttl: 42 });
      expect(new UdpBlast(null, { packetSize: 42 })).to.include({ packetSize: 42 });
      expect(new UdpBlast(null, { highWaterMark: 42 })._writableState).to.include({ highWaterMark: 42 });
      done();
    })

    it('is a Stream', function(done) {
      expect(new UdpBlast()).to.be.an.instanceof(Stream);
      done();
    })

    it('handles port number destination', function(done) {
      expect(new UdpBlast(1234).dst).to.include({ host: 'localhost', port: 1234 });
      done();
    })

    it('throws on invalid destinations', function(done) {
      var create = function (dst) { return function() {
        return new UdpBlast(dst);
      }};
      expect(create(true)).to.throw(TypeError);
      expect(create('localhost')).to.throw(TypeError);
      expect(create({})).to.throw(TypeError);
      done();
    })

  })

  describe('stream', function(){

    it('bails on non-existent addresses', function(done) {
      var blaster = new UdpBlast({ host: 'this.does.not.exist', port: 1234 });
      new BufferList().append('test').pipe(blaster);
      blaster.on('error', function(err) {
        expect(err).to.be.an.instanceof(Error);
        done();
      });
    })

    it('handles a multicast ipv4 address', function(done) {
      var blaster = new UdpBlast({ host: '224.20.54.121', port: '1234' }, { ttl: 1 });
      new BufferList().append('test').pipe(blaster);
      blaster.on('close', done);
    })

    it('handles an ipv6 address', function(done) {
      var blaster = new UdpBlast({ host: '127::1', port: 1234 });
      blaster.write('test');
      blaster.end();
      blaster.on('close', done);
    })

    it('server receives correct udp datagrams', function(done) {
      var server = Dgram.createSocket('udp4');
      server.bind(0, 'localhost', function(err) {
        expect(err).to.not.exist();

        var blaster = new UdpBlast({ host: server.address().address, port: server.address().port }, { packetSize: 4, ttl: 1 });
        expect(blaster).to.exist();

        var bl = new BufferList();
        bl.append('boring...').end();
        bl.pipe(blaster);

        var cnt = 0;
        server.on('message', function(data) {
          var parts = ['bori', 'ng..', '.'];
          expect(data.toString()).to.equal(parts[cnt]);
          if (++cnt === 3) {
            server.on('close', done);
            server.close();
          }
        });
      });
    })

    it('handles immediate end', function(done) {
      var server = Dgram.createSocket('udp4');
      server.bind(0, 'localhost', function(err) {
        expect(err).to.not.exist();

        new UdpBlast({ host: server.address().address, port: server.address().port })
          .on('close', done)
          .end();
      });
    })

  })

  describe('dns stubs', function(){

    before(function(done){
      dnsStubs.lookup = function(host, callback) {
        callback(null, 'abc.def', 16);
      };
      done();
    })

    after(function(done){
      var dns = require('dns');
      dnsStubs.lookup = dns.lookup.bind(dns);
      done();
    })

    it('bails on unknown families', function(done) {
      var blaster = new UdpBlast();
      new BufferList().append('test').pipe(blaster);
      blaster.on('error', function(err) {
        expect(err).to.be.an.instanceof(Error);
        done();
      });
    })

  })

  describe('dgram stubs', function(){

    before(function(done){
      dgramStubs.createSocket = function() {
        var socket = Dgram.createSocket.apply(this, arguments);
        socket.bind = function(arg1, arg2, callback) {
          if (typeof arg1 === 'function') callback = arg1;
          else if (typeof arg2 === 'function') callback = arg2;
          callback(new Error('unknown bind error'));
        };
        return socket;
      };
      done();
    })

    after(function(done){
      dgramStubs.createSocket = Dgram.createSocket.bind(Dgram);
      done();
    })

    it('bails on local bind errors', function(done) {
      var blaster = new UdpBlast();
      new BufferList().append('test').pipe(blaster);
      blaster.on('error', function(err) {
        expect(err).to.be.an.instanceof(Error);
        done();
      });
    })

  })

})
