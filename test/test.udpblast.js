/* jshint node:true */

var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.describe, it = lab.it;
var before = lab.before, after = lab.after;
var beforeEach = lab.beforeEach, afterEach = lab.afterEach;
var expect = Lab.expect;

var Dgram = require('dgram'),
		EventEmitter = require('events').EventEmitter;
var BufferList = require('bl');

var Proxyquire =  require('proxyquire')

var dnsStubs = {}, dgramStubs = {};
var UdpBlast = Proxyquire('../udpblast', { dns: dnsStubs, dgram: dgramStubs });

describe('UdpBlast', function(){

  describe('#new', function(){

    it('accepts empty argument list', function(done){
  		expect(new UdpBlast).to.be.an.instanceof(UdpBlast);
      done();
    })

    it('stores option properties', function(done) {
    	expect(new UdpBlast(null, { ttl: 42 })).to.have.property('ttl', 42);
    	expect(new UdpBlast(null, { packetSize: 42 })).to.have.property('packetSize', 42);
    	expect(new UdpBlast(null, { highWaterMark: 42 })._writableState).to.have.property('highWaterMark', 42);
      done();
    })

    it('shold be an EventEmitter', function(done) {
  		expect(new UdpBlast()).to.be.an.instanceof(EventEmitter);
      done();
    })

    it('handles port number destination', function(done) {
    	expect(new UdpBlast(1234)).to.have.deep.property('dst.host', 'localhost')
    	expect(new UdpBlast(1234)).to.have.deep.property('dst.port', 1234)
      done();
    })

  })

  describe('stream', function(){

 	  it('bails on invalid addresses', function(done) {
	  	var blaster = new UdpBlast({ host:'this.does.not.exist', port:1234 });
	  	new BufferList().append('test').pipe(blaster);
	  	blaster.on('error', function(err) {
	  		expect(err).to.be.an.instanceof(Error);
	  		done();
	  	});
	  	blaster.on('finish', function() {
	  		expect(this).to.be.undefined;
	  	});
	  })

	  it('handles a multicast ipv4 address', function(done) {
	  	var blaster = new UdpBlast({ host:'224.20.54.121', port:1234 }, { ttl: 1 });
	  	new BufferList().append('test').pipe(blaster);
	  	blaster.on('finish', done);
	  })

	  it('handles an ipv6 address', function(done) {
	  	var blaster = new UdpBlast({ host:'127::1', port:1234 });
	  	new BufferList().append('test').pipe(blaster);
	  	blaster.on('finish', done);
	  })

	  it('outputs valid udp datagrams', function(done) {
	  	var server = Dgram.createSocket('udp4');
	  	server.bind(0, 'localhost', function(err) {
	  		expect(err).to.not.exist;

	  		var cnt = 0;

	  		server.on('close', done);
	  		server.on('message', function(data) {
	  			var parts = ['bori', 'ng..', '.'];
	  			expect(data.toString()).to.equal(parts[cnt]);
					if (++cnt === 3) server.close();
	  		});

		  	var blaster = new UdpBlast({ host: server.address().address, port: server.address().port }, { packetSize: 4, ttl: 1 });
	  		expect(blaster).to.exist;

		  	var bl = new BufferList();
		  	bl.append('boring...').end();
		  	bl.pipe(blaster);
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
	  	blaster.on('finish', function() {
	  		expect(this).to.be.undefined;
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
	  	blaster.on('finish', function() {
	  		expect(this).to.be.undefined;
	  	});
	  })

  })

})