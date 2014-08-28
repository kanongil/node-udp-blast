# udp-blast node.js stream module

Writable stream that packetizes the input and streams it to the network using the UDP protocol.

## Usage

```javascript
var Fs = require('fs');
var UdpBlast = require('udp-blast');

var dst = { host: 'localhost', port: 1234 };
var options = { packetSize: 1024 };

var blaster = new UdpBlast(dst, options);

// blast as fast as possible
Fs.createReadStream(…).pipe(blaster);
```

## Methods

### new UdpBlast(dst, [options])

This creates a new `Writable` stream that quickly blasts any input.

`dst` should be an `object` with `host` and `port` properties.
If `dst` is a number, it will be treated as: `{ host: 'localhost', port: dst }`.

#### Options

* `packetSize` - Output `packetSize` bytes in each UDP packet, default = 512.
* `ttl` - Set TTL for the UDP packets.
* `highWaterMark` - `Writable` buffering option.

## Installation

```sh
$ npm install udp-blast
```

# License
(BSD 2-Clause License)

Copyright (c) 2014, Gil Pedersen &lt;gpdev@gpost.dk&gt;  
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met: 

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer. 
2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution. 

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.