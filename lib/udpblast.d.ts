import { Writable } from 'node:stream';

interface UdpBlastOptions {

    /** Set the `Writable` internal buffer size. */
    highWaterMark?: number;

    /** Collate input buffers into `packetSize` bytes in each UDP packet, default `512`  */
    packetSize?: number;

    /** Custom UDP packet TTL value. */
    ttl?: number;
}

export class UdpBlast extends Writable {

    ttl: number;
    packetSize: number;

    constructor(dst?: { host: string; port: number } | number, options?: UdpBlastOptions);
}
