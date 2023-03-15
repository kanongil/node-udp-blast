import { Writable } from 'node:stream';

import { UdpBlast } from '../lib/udpblast';

import * as Lab from '@hapi/lab';

const { expect } = Lab.types;

// Constructor

expect.type<Writable>(new UdpBlast());
expect.type<UdpBlast>(new UdpBlast(1234));
expect.type<UdpBlast>(new UdpBlast({ host: 'test', port: 1234 }));
expect.type<UdpBlast>(new UdpBlast(1234, { highWaterMark: 10, ttl: 3, packetSize: 200 }));

expect.error(new UdpBlast('1234'));

