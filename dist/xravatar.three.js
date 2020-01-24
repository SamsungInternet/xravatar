/**
 * Copyright 2019 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *     http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
const proxyMarker = Symbol("Comlink.proxy");
const createEndpoint = Symbol("Comlink.endpoint");
const releaseProxy = Symbol("Comlink.releaseProxy");
const throwSet = new WeakSet();
const transferHandlers = new Map([
    [
        "proxy",
        {
            canHandle: obj => obj && obj[proxyMarker],
            serialize(obj) {
                const { port1, port2 } = new MessageChannel();
                expose(obj, port1);
                return [port2, [port2]];
            },
            deserialize: (port) => {
                port.start();
                return wrap(port);
            }
        }
    ],
    [
        "throw",
        {
            canHandle: obj => throwSet.has(obj),
            serialize(obj) {
                const isError = obj instanceof Error;
                let serialized = obj;
                if (isError) {
                    serialized = {
                        isError,
                        message: obj.message,
                        stack: obj.stack
                    };
                }
                return [serialized, []];
            },
            deserialize(obj) {
                if (obj.isError) {
                    throw Object.assign(new Error(), obj);
                }
                throw obj;
            }
        }
    ]
]);
function expose(obj, ep = self) {
    ep.addEventListener("message", function callback(ev) {
        if (!ev || !ev.data) {
            return;
        }
        const { id, type, path } = Object.assign({ path: [] }, ev.data);
        const argumentList = (ev.data.argumentList || []).map(fromWireValue);
        let returnValue;
        try {
            const parent = path.slice(0, -1).reduce((obj, prop) => obj[prop], obj);
            const rawValue = path.reduce((obj, prop) => obj[prop], obj);
            switch (type) {
                case 0 /* GET */:
                    {
                        returnValue = rawValue;
                    }
                    break;
                case 1 /* SET */:
                    {
                        parent[path.slice(-1)[0]] = fromWireValue(ev.data.value);
                        returnValue = true;
                    }
                    break;
                case 2 /* APPLY */:
                    {
                        returnValue = rawValue.apply(parent, argumentList);
                    }
                    break;
                case 3 /* CONSTRUCT */:
                    {
                        const value = new rawValue(...argumentList);
                        returnValue = proxy(value);
                    }
                    break;
                case 4 /* ENDPOINT */:
                    {
                        const { port1, port2 } = new MessageChannel();
                        expose(obj, port2);
                        returnValue = transfer(port1, [port1]);
                    }
                    break;
                case 5 /* RELEASE */:
                    {
                        returnValue = undefined;
                    }
                    break;
            }
        }
        catch (e) {
            returnValue = e;
            throwSet.add(e);
        }
        Promise.resolve(returnValue)
            .catch(e => {
            throwSet.add(e);
            return e;
        })
            .then(returnValue => {
            const [wireValue, transferables] = toWireValue(returnValue);
            ep.postMessage(Object.assign(Object.assign({}, wireValue), { id }), transferables);
            if (type === 5 /* RELEASE */) {
                // detach and deactive after sending release response above.
                ep.removeEventListener("message", callback);
                closeEndPoint(ep);
            }
        });
    });
    if (ep.start) {
        ep.start();
    }
}
function isMessagePort(endpoint) {
    return endpoint.constructor.name === "MessagePort";
}
function closeEndPoint(endpoint) {
    if (isMessagePort(endpoint))
        endpoint.close();
}
function wrap(ep, target) {
    return createProxy(ep, [], target);
}
function throwIfProxyReleased(isReleased) {
    if (isReleased) {
        throw new Error("Proxy has been released and is not useable");
    }
}
function createProxy(ep, path = [], target = function () { }) {
    let isProxyReleased = false;
    const proxy = new Proxy(target, {
        get(_target, prop) {
            throwIfProxyReleased(isProxyReleased);
            if (prop === releaseProxy) {
                return () => {
                    return requestResponseMessage(ep, {
                        type: 5 /* RELEASE */,
                        path: path.map(p => p.toString())
                    }).then(() => {
                        closeEndPoint(ep);
                        isProxyReleased = true;
                    });
                };
            }
            if (prop === "then") {
                if (path.length === 0) {
                    return { then: () => proxy };
                }
                const r = requestResponseMessage(ep, {
                    type: 0 /* GET */,
                    path: path.map(p => p.toString())
                }).then(fromWireValue);
                return r.then.bind(r);
            }
            return createProxy(ep, [...path, prop]);
        },
        set(_target, prop, rawValue) {
            throwIfProxyReleased(isProxyReleased);
            // FIXME: ES6 Proxy Handler `set` methods are supposed to return a
            // boolean. To show good will, we return true asynchronously ¯\_(ツ)_/¯
            const [value, transferables] = toWireValue(rawValue);
            return requestResponseMessage(ep, {
                type: 1 /* SET */,
                path: [...path, prop].map(p => p.toString()),
                value
            }, transferables).then(fromWireValue);
        },
        apply(_target, _thisArg, rawArgumentList) {
            throwIfProxyReleased(isProxyReleased);
            const last = path[path.length - 1];
            if (last === createEndpoint) {
                return requestResponseMessage(ep, {
                    type: 4 /* ENDPOINT */
                }).then(fromWireValue);
            }
            // We just pretend that `bind()` didn’t happen.
            if (last === "bind") {
                return createProxy(ep, path.slice(0, -1));
            }
            const [argumentList, transferables] = processArguments(rawArgumentList);
            return requestResponseMessage(ep, {
                type: 2 /* APPLY */,
                path: path.map(p => p.toString()),
                argumentList
            }, transferables).then(fromWireValue);
        },
        construct(_target, rawArgumentList) {
            throwIfProxyReleased(isProxyReleased);
            const [argumentList, transferables] = processArguments(rawArgumentList);
            return requestResponseMessage(ep, {
                type: 3 /* CONSTRUCT */,
                path: path.map(p => p.toString()),
                argumentList
            }, transferables).then(fromWireValue);
        }
    });
    return proxy;
}
function myFlat(arr) {
    return Array.prototype.concat.apply([], arr);
}
function processArguments(argumentList) {
    const processed = argumentList.map(toWireValue);
    return [processed.map(v => v[0]), myFlat(processed.map(v => v[1]))];
}
const transferCache = new WeakMap();
function transfer(obj, transfers) {
    transferCache.set(obj, transfers);
    return obj;
}
function proxy(obj) {
    return Object.assign(obj, { [proxyMarker]: true });
}
function windowEndpoint(w, context = self, targetOrigin = "*") {
    return {
        postMessage: (msg, transferables) => w.postMessage(msg, targetOrigin, transferables),
        addEventListener: context.addEventListener.bind(context),
        removeEventListener: context.removeEventListener.bind(context)
    };
}
function toWireValue(value) {
    for (const [name, handler] of transferHandlers) {
        if (handler.canHandle(value)) {
            const [serializedValue, transferables] = handler.serialize(value);
            return [
                {
                    type: 3 /* HANDLER */,
                    name,
                    value: serializedValue
                },
                transferables
            ];
        }
    }
    return [
        {
            type: 0 /* RAW */,
            value
        },
        transferCache.get(value) || []
    ];
}
function fromWireValue(value) {
    switch (value.type) {
        case 3 /* HANDLER */:
            return transferHandlers.get(value.name).deserialize(value.value);
        case 0 /* RAW */:
            return value.value;
    }
}
function requestResponseMessage(ep, msg, transfers) {
    return new Promise(resolve => {
        const id = generateUUID();
        ep.addEventListener("message", function l(ev) {
            if (!ev.data || !ev.data.id || ev.data.id !== id) {
                return;
            }
            ep.removeEventListener("message", l);
            resolve(ev.data);
        });
        if (ep.start) {
            ep.start();
        }
        ep.postMessage(Object.assign({ id }, msg), transfers);
    });
}
function generateUUID() {
    return new Array(4)
        .fill(0)
        .map(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16))
        .join("-");
}

var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

///NOTE: This file was generated by minify.js from lzma_worker.js. Do not modify.

/// © 2015 Nathan Rugg <nmrugg@gmail.com> | MIT
/// See LICENSE for more details.

/* jshint noarg:true, boss:true, unused:strict, strict:true, undef:true, noarg: true, forin:true, evil:true, newcap:false, -W041, -W021, worker:true, browser:true, node:true */

/* global setImmediate, setTimeout, window, onmessage */



var LZMA = (function () {
    
    var 
        /** ds */
        action_decompress = 2,
        /** de */
        action_progress   = 3,
        wait = typeof setImmediate == "function" ? setImmediate : setTimeout,
        __4294967296 = 4294967296,
        N1_longLit = [4294967295, -__4294967296],
        
        P0_longLit = [0, 0],
        P1_longLit = [1, 0];
    
    function update_progress(percent, cbn) {
        postMessage({
            action: action_progress,
            cbn: cbn,
            result: percent
        });
    }
    
    function initDim(len) {
        ///NOTE: This is MUCH faster than "new Array(len)" in newer versions of v8 (starting with Node.js 0.11.15, which uses v8 3.28.73).
        var a = [];
        a[len - 1] = undefined;
        return a;
    }
    
    function add(a, b) {
        return create(a[0] + b[0], a[1] + b[1]);
    }
    
    
    
    function compare(a, b) {
        var nega, negb;
        if (a[0] == b[0] && a[1] == b[1]) {
            return 0;
        }
        nega = a[1] < 0;
        negb = b[1] < 0;
        if (nega && !negb) {
            return -1;
        }
        if (!nega && negb) {
            return 1;
        }
        if (sub(a, b)[1] < 0) {
            return -1;
        }
        return 1;
    }
    
    function create(valueLow, valueHigh) {
        var diffHigh, diffLow;
        valueHigh %= 1.8446744073709552E19;
        valueLow %= 1.8446744073709552E19;
        diffHigh = valueHigh % __4294967296;
        diffLow = Math.floor(valueLow / __4294967296) * __4294967296;
        valueHigh = valueHigh - diffHigh + diffLow;
        valueLow = valueLow - diffLow + diffHigh;
        while (valueLow < 0) {
            valueLow += __4294967296;
            valueHigh -= __4294967296;
        }
        while (valueLow > 4294967295) {
            valueLow -= __4294967296;
            valueHigh += __4294967296;
        }
        valueHigh = valueHigh % 1.8446744073709552E19;
        while (valueHigh > 9223372032559808512) {
            valueHigh -= 1.8446744073709552E19;
        }
        while (valueHigh < -9223372036854775808) {
            valueHigh += 1.8446744073709552E19;
        }
        return [valueLow, valueHigh];
    }
    
    
    function fromInt(value) {
        if (value >= 0) {
            return [value, 0];
        } else {
            return [value + __4294967296, -__4294967296];
        }
    }
    
    function lowBits_0(a) {
        if (a[0] >= 2147483648) {
            return ~~Math.max(Math.min(a[0] - __4294967296, 2147483647), -2147483648);
        } else {
            return ~~Math.max(Math.min(a[0], 2147483647), -2147483648);
        }
    }
    
    
    function sub(a, b) {
        return create(a[0] - b[0], a[1] - b[1]);
    }
    
    function $ByteArrayInputStream(this$static, buf) {
        this$static.buf = buf;
        this$static.pos = 0;
        this$static.count = buf.length;
        return this$static;
    }
    
    /** ds */
    function $read(this$static) {
        if (this$static.pos >= this$static.count)
            return -1;
        return this$static.buf[this$static.pos++] & 255;
    }
    /** de */
    
    
    function $ByteArrayOutputStream(this$static) {
        this$static.buf = initDim(32);
        this$static.count = 0;
        return this$static;
    }
    
    function $toByteArray(this$static) {
        var data = this$static.buf;
        data.length = this$static.count;
        return data;
    }
    
    
    
    function $write_0(this$static, buf, off, len) {
        arraycopy(buf, off, this$static.buf, this$static.count, len);
        this$static.count += len;
    }
    
    
    
    function arraycopy(src, srcOfs, dest, destOfs, len) {
        for (var i = 0; i < len; ++i) {
            dest[destOfs + i] = src[srcOfs + i];
        }
    }
    
    
    
    /** ds */
    function $init_0(this$static, input, output) {
        var decoder,
            hex_length = "",
            i,
            properties = [],
            r,
            tmp_length;
        
        for (i = 0; i < 5; ++i) {
            r = $read(input);
            if (r == -1)
                throw new Error("truncated input");
            properties[i] = r << 24 >> 24;
        }
        
        decoder = $Decoder({});
        if (!$SetDecoderProperties(decoder, properties)) {
            throw new Error("corrupted input");
        }
        for (i = 0; i < 64; i += 8) {
            r = $read(input);
            if (r == -1)
                throw new Error("truncated input");
            r = r.toString(16);
            if (r.length == 1) r = "0" + r;
            hex_length = r + "" + hex_length;
        }
        
        /// Was the length set in the header (if it was compressed from a stream, the length is all f"s).
        if (/^0+$|^f+$/i.test(hex_length)) {
            /// The length is unknown, so set to -1.
            this$static.length_0 = N1_longLit;
        } else {
            ///NOTE: If there is a problem with the decoder because of the length, you can always set the length to -1 (N1_longLit) which means unknown.
            tmp_length = parseInt(hex_length, 16);
            /// If the length is too long to handle, just set it to unknown.
            if (tmp_length > 4294967295) {
                this$static.length_0 = N1_longLit;
            } else {
                this$static.length_0 = fromInt(tmp_length);
            }
        }
        
        this$static.chunker = $CodeInChunks(decoder, input, output, this$static.length_0);
    }
    
    function $LZMAByteArrayDecompressor(this$static, data) {
        this$static.output = $ByteArrayOutputStream({});
        $init_0(this$static, $ByteArrayInputStream({}, data), this$static.output);
        return this$static;
    }
    /** de */
    
    /** ds */
    function $CopyBlock(this$static, distance, len) {
        var pos = this$static._pos - distance - 1;
        if (pos < 0) {
            pos += this$static._windowSize;
        }
        for (; len != 0; --len) {
            if (pos >= this$static._windowSize) {
                pos = 0;
            }
            this$static._buffer[this$static._pos++] = this$static._buffer[pos++];
            if (this$static._pos >= this$static._windowSize) {
                $Flush_0(this$static);
            }
        }
    }
    
    function $Create_5(this$static, windowSize) {
        if (this$static._buffer == null || this$static._windowSize != windowSize) {
            this$static._buffer = initDim(windowSize);
        }
        this$static._windowSize = windowSize;
        this$static._pos = 0;
        this$static._streamPos = 0;
    }
    
    function $Flush_0(this$static) {
        var size = this$static._pos - this$static._streamPos;
        if (!size) {
            return;
        }
        $write_0(this$static._stream, this$static._buffer, this$static._streamPos, size);
        if (this$static._pos >= this$static._windowSize) {
            this$static._pos = 0;
        }
        this$static._streamPos = this$static._pos;
    }
    
    function $GetByte(this$static, distance) {
        var pos = this$static._pos - distance - 1;
        if (pos < 0) {
            pos += this$static._windowSize;
        }
        return this$static._buffer[pos];
    }
    
    function $PutByte(this$static, b) {
        this$static._buffer[this$static._pos++] = b;
        if (this$static._pos >= this$static._windowSize) {
            $Flush_0(this$static);
        }
    }
    
    function $ReleaseStream(this$static) {
        $Flush_0(this$static);
        this$static._stream = null;
    }
    /** de */
    
    function GetLenToPosState(len) {
        len -= 2;
        if (len < 4) {
            return len;
        }
        return 3;
    }
    
    function StateUpdateChar(index) {
        if (index < 4) {
            return 0;
        }
        if (index < 10) {
            return index - 3;
        }
        return index - 6;
    }
    
    
    /** ds */
    function $Chunker(this$static, decoder) {
        this$static.decoder = decoder;
        this$static.encoder = null;
        this$static.alive = 1;
        return this$static;
    }
    /** de */
    
    function $processChunk(this$static) {
        if (!this$static.alive) {
            throw new Error("bad state");
        }
        
        if (this$static.encoder) {
            throw new Error("No encoding");
            
        } else {
            /// co:throw new Error("No decoding");
            /** ds */
            $processDecoderChunk(this$static);
            /** de */
        }
        return this$static.alive;
    }
    
    /** ds */
    function $processDecoderChunk(this$static) {
        var result = $CodeOneChunk(this$static.decoder);
        if (result == -1) {
            throw new Error("corrupted input");
        }
        this$static.inBytesProcessed = N1_longLit;
        this$static.outBytesProcessed = this$static.decoder.nowPos64;
        if (result || compare(this$static.decoder.outSize, P0_longLit) >= 0 && compare(this$static.decoder.nowPos64, this$static.decoder.outSize) >= 0) {
            $Flush_0(this$static.decoder.m_OutWindow);
            $ReleaseStream(this$static.decoder.m_OutWindow);
            this$static.decoder.m_RangeDecoder.Stream = null;
            this$static.alive = 0;
        }
    }
    /** de */
    
    
    /** ds */
    function $CodeInChunks(this$static, inStream, outStream, outSize) {
        this$static.m_RangeDecoder.Stream = inStream;
        $ReleaseStream(this$static.m_OutWindow);
        this$static.m_OutWindow._stream = outStream;
        $Init_1(this$static);
        this$static.state = 0;
        this$static.rep0 = 0;
        this$static.rep1 = 0;
        this$static.rep2 = 0;
        this$static.rep3 = 0;
        this$static.outSize = outSize;
        this$static.nowPos64 = P0_longLit;
        this$static.prevByte = 0;
        return $Chunker({}, this$static);
    }
    
    function $CodeOneChunk(this$static) {
        var decoder2, distance, len, numDirectBits, posSlot, posState;
        posState = lowBits_0(this$static.nowPos64) & this$static.m_PosStateMask;
        if (!$DecodeBit(this$static.m_RangeDecoder, this$static.m_IsMatchDecoders, (this$static.state << 4) + posState)) {
            decoder2 = $GetDecoder(this$static.m_LiteralDecoder, lowBits_0(this$static.nowPos64), this$static.prevByte);
            if (this$static.state < 7) {
                this$static.prevByte = $DecodeNormal(decoder2, this$static.m_RangeDecoder);
            } else {
                this$static.prevByte = $DecodeWithMatchByte(decoder2, this$static.m_RangeDecoder, $GetByte(this$static.m_OutWindow, this$static.rep0));
            }
            $PutByte(this$static.m_OutWindow, this$static.prevByte);
            this$static.state = StateUpdateChar(this$static.state);
            this$static.nowPos64 = add(this$static.nowPos64, P1_longLit);
        } else {
            if ($DecodeBit(this$static.m_RangeDecoder, this$static.m_IsRepDecoders, this$static.state)) {
                len = 0;
                if (!$DecodeBit(this$static.m_RangeDecoder, this$static.m_IsRepG0Decoders, this$static.state)) {
                    if (!$DecodeBit(this$static.m_RangeDecoder, this$static.m_IsRep0LongDecoders, (this$static.state << 4) + posState)) {
                        this$static.state = this$static.state < 7?9:11;
                        len = 1;
                    }
                } else {
                    if (!$DecodeBit(this$static.m_RangeDecoder, this$static.m_IsRepG1Decoders, this$static.state)) {
                        distance = this$static.rep1;
                    } else {
                        if (!$DecodeBit(this$static.m_RangeDecoder, this$static.m_IsRepG2Decoders, this$static.state)) {
                            distance = this$static.rep2;
                        } else {
                            distance = this$static.rep3;
                            this$static.rep3 = this$static.rep2;
                        }
                        this$static.rep2 = this$static.rep1;
                    }
                    this$static.rep1 = this$static.rep0;
                    this$static.rep0 = distance;
                }
                if (!len) {
                    len = $Decode(this$static.m_RepLenDecoder, this$static.m_RangeDecoder, posState) + 2;
                    this$static.state = this$static.state < 7?8:11;
                }
            } else {
                this$static.rep3 = this$static.rep2;
                this$static.rep2 = this$static.rep1;
                this$static.rep1 = this$static.rep0;
                len = 2 + $Decode(this$static.m_LenDecoder, this$static.m_RangeDecoder, posState);
                this$static.state = this$static.state < 7?7:10;
                posSlot = $Decode_0(this$static.m_PosSlotDecoder[GetLenToPosState(len)], this$static.m_RangeDecoder);
                if (posSlot >= 4) {
                    numDirectBits = (posSlot >> 1) - 1;
                    this$static.rep0 = (2 | posSlot & 1) << numDirectBits;
                    if (posSlot < 14) {
                        this$static.rep0 += ReverseDecode(this$static.m_PosDecoders, this$static.rep0 - posSlot - 1, this$static.m_RangeDecoder, numDirectBits);
                    } else {
                        this$static.rep0 += $DecodeDirectBits(this$static.m_RangeDecoder, numDirectBits - 4) << 4;
                        this$static.rep0 += $ReverseDecode(this$static.m_PosAlignDecoder, this$static.m_RangeDecoder);
                        if (this$static.rep0 < 0) {
                            if (this$static.rep0 == -1) {
                                return 1;
                            }
                            return -1;
                        }
                    }
                } else 
                    this$static.rep0 = posSlot;
            }
            if (compare(fromInt(this$static.rep0), this$static.nowPos64) >= 0 || this$static.rep0 >= this$static.m_DictionarySizeCheck) {
                return -1;
            }
            $CopyBlock(this$static.m_OutWindow, this$static.rep0, len);
            this$static.nowPos64 = add(this$static.nowPos64, fromInt(len));
            this$static.prevByte = $GetByte(this$static.m_OutWindow, 0);
        }
        return 0;
    }
    
    function $Decoder(this$static) {
        this$static.m_OutWindow = {};
        this$static.m_RangeDecoder = {};
        this$static.m_IsMatchDecoders = initDim(192);
        this$static.m_IsRepDecoders = initDim(12);
        this$static.m_IsRepG0Decoders = initDim(12);
        this$static.m_IsRepG1Decoders = initDim(12);
        this$static.m_IsRepG2Decoders = initDim(12);
        this$static.m_IsRep0LongDecoders = initDim(192);
        this$static.m_PosSlotDecoder = initDim(4);
        this$static.m_PosDecoders = initDim(114);
        this$static.m_PosAlignDecoder = $BitTreeDecoder({}, 4);
        this$static.m_LenDecoder = $Decoder$LenDecoder({});
        this$static.m_RepLenDecoder = $Decoder$LenDecoder({});
        this$static.m_LiteralDecoder = {};
        for (var i = 0; i < 4; ++i) {
            this$static.m_PosSlotDecoder[i] = $BitTreeDecoder({}, 6);
        }
        return this$static;
    }
    
    function $Init_1(this$static) {
        this$static.m_OutWindow._streamPos = 0;
        this$static.m_OutWindow._pos = 0;
        InitBitModels(this$static.m_IsMatchDecoders);
        InitBitModels(this$static.m_IsRep0LongDecoders);
        InitBitModels(this$static.m_IsRepDecoders);
        InitBitModels(this$static.m_IsRepG0Decoders);
        InitBitModels(this$static.m_IsRepG1Decoders);
        InitBitModels(this$static.m_IsRepG2Decoders);
        InitBitModels(this$static.m_PosDecoders);
        $Init_0(this$static.m_LiteralDecoder);
        for (var i = 0; i < 4; ++i) {
            InitBitModels(this$static.m_PosSlotDecoder[i].Models);
        }
        $Init(this$static.m_LenDecoder);
        $Init(this$static.m_RepLenDecoder);
        InitBitModels(this$static.m_PosAlignDecoder.Models);
        $Init_8(this$static.m_RangeDecoder);
    }
    
    function $SetDecoderProperties(this$static, properties) {
        var dictionarySize, i, lc, lp, pb, remainder, val;
        if (properties.length < 5)
            return 0;
        val = properties[0] & 255;
        lc = val % 9;
        remainder = ~~(val / 9);
        lp = remainder % 5;
        pb = ~~(remainder / 5);
        dictionarySize = 0;
        for (i = 0; i < 4; ++i) {
            dictionarySize += (properties[1 + i] & 255) << i * 8;
        }
        ///NOTE: If the input is bad, it might call for an insanely large dictionary size, which would crash the script.
        if (dictionarySize > 99999999 || !$SetLcLpPb(this$static, lc, lp, pb)) {
            return 0;
        }
        return $SetDictionarySize(this$static, dictionarySize);
    }
    
    function $SetDictionarySize(this$static, dictionarySize) {
        if (dictionarySize < 0) {
            return 0;
        }
        if (this$static.m_DictionarySize != dictionarySize) {
            this$static.m_DictionarySize = dictionarySize;
            this$static.m_DictionarySizeCheck = Math.max(this$static.m_DictionarySize, 1);
            $Create_5(this$static.m_OutWindow, Math.max(this$static.m_DictionarySizeCheck, 4096));
        }
        return 1;
    }
    
    function $SetLcLpPb(this$static, lc, lp, pb) {
        if (lc > 8 || lp > 4 || pb > 4) {
            return 0;
        }
        $Create_0(this$static.m_LiteralDecoder, lp, lc);
        var numPosStates = 1 << pb;
        $Create(this$static.m_LenDecoder, numPosStates);
        $Create(this$static.m_RepLenDecoder, numPosStates);
        this$static.m_PosStateMask = numPosStates - 1;
        return 1;
    }
    
    function $Create(this$static, numPosStates) {
        for (; this$static.m_NumPosStates < numPosStates; ++this$static.m_NumPosStates) {
            this$static.m_LowCoder[this$static.m_NumPosStates] = $BitTreeDecoder({}, 3);
            this$static.m_MidCoder[this$static.m_NumPosStates] = $BitTreeDecoder({}, 3);
        }
    }
    
    function $Decode(this$static, rangeDecoder, posState) {
        if (!$DecodeBit(rangeDecoder, this$static.m_Choice, 0)) {
            return $Decode_0(this$static.m_LowCoder[posState], rangeDecoder);
        }
        var symbol = 8;
        if (!$DecodeBit(rangeDecoder, this$static.m_Choice, 1)) {
            symbol += $Decode_0(this$static.m_MidCoder[posState], rangeDecoder);
        } else {
            symbol += 8 + $Decode_0(this$static.m_HighCoder, rangeDecoder);
        }
        return symbol;
    }
    
    function $Decoder$LenDecoder(this$static) {
        this$static.m_Choice = initDim(2);
        this$static.m_LowCoder = initDim(16);
        this$static.m_MidCoder = initDim(16);
        this$static.m_HighCoder = $BitTreeDecoder({}, 8);
        this$static.m_NumPosStates = 0;
        return this$static;
    }
    
    function $Init(this$static) {
        InitBitModels(this$static.m_Choice);
        for (var posState = 0; posState < this$static.m_NumPosStates; ++posState) {
            InitBitModels(this$static.m_LowCoder[posState].Models);
            InitBitModels(this$static.m_MidCoder[posState].Models);
        }
        InitBitModels(this$static.m_HighCoder.Models);
    }
    
    
    function $Create_0(this$static, numPosBits, numPrevBits) {
        var i, numStates;
        if (this$static.m_Coders != null && this$static.m_NumPrevBits == numPrevBits && this$static.m_NumPosBits == numPosBits)
            return;
        this$static.m_NumPosBits = numPosBits;
        this$static.m_PosMask = (1 << numPosBits) - 1;
        this$static.m_NumPrevBits = numPrevBits;
        numStates = 1 << this$static.m_NumPrevBits + this$static.m_NumPosBits;
        this$static.m_Coders = initDim(numStates);
        for (i = 0; i < numStates; ++i)
            this$static.m_Coders[i] = $Decoder$LiteralDecoder$Decoder2({});
    }
    
    function $GetDecoder(this$static, pos, prevByte) {
        return this$static.m_Coders[((pos & this$static.m_PosMask) << this$static.m_NumPrevBits) + ((prevByte & 255) >>> 8 - this$static.m_NumPrevBits)];
    }
    
    function $Init_0(this$static) {
        var i, numStates;
        numStates = 1 << this$static.m_NumPrevBits + this$static.m_NumPosBits;
        for (i = 0; i < numStates; ++i) {
            InitBitModels(this$static.m_Coders[i].m_Decoders);
        }
    }
    
    
    function $DecodeNormal(this$static, rangeDecoder) {
        var symbol = 1;
        do {
            symbol = symbol << 1 | $DecodeBit(rangeDecoder, this$static.m_Decoders, symbol);
        } while (symbol < 256);
        return symbol << 24 >> 24;
    }
    
    function $DecodeWithMatchByte(this$static, rangeDecoder, matchByte) {
        var bit, matchBit, symbol = 1;
        do {
            matchBit = matchByte >> 7 & 1;
            matchByte <<= 1;
            bit = $DecodeBit(rangeDecoder, this$static.m_Decoders, (1 + matchBit << 8) + symbol);
            symbol = symbol << 1 | bit;
            if (matchBit != bit) {
                while (symbol < 256) {
                    symbol = symbol << 1 | $DecodeBit(rangeDecoder, this$static.m_Decoders, symbol);
                }
            break;
            }
        } while (symbol < 256);
        return symbol << 24 >> 24;
    }
    
    function $Decoder$LiteralDecoder$Decoder2(this$static) {
        this$static.m_Decoders = initDim(768);
        return this$static;
    }
    
    /** de */
    
    /** ds */
    function $BitTreeDecoder(this$static, numBitLevels) {
        this$static.NumBitLevels = numBitLevels;
        this$static.Models = initDim(1 << numBitLevels);
        return this$static;
    }
    
    function $Decode_0(this$static, rangeDecoder) {
        var bitIndex, m = 1;
        for (bitIndex = this$static.NumBitLevels; bitIndex != 0; --bitIndex) {
            m = (m << 1) + $DecodeBit(rangeDecoder, this$static.Models, m);
        }
        return m - (1 << this$static.NumBitLevels);
    }
    
    function $ReverseDecode(this$static, rangeDecoder) {
        var bit, bitIndex, m = 1, symbol = 0;
        for (bitIndex = 0; bitIndex < this$static.NumBitLevels; ++bitIndex) {
            bit = $DecodeBit(rangeDecoder, this$static.Models, m);
            m <<= 1;
            m += bit;
            symbol |= bit << bitIndex;
        }
        return symbol;
    }
    
    function ReverseDecode(Models, startIndex, rangeDecoder, NumBitLevels) {
        var bit, bitIndex, m = 1, symbol = 0;
        for (bitIndex = 0; bitIndex < NumBitLevels; ++bitIndex) {
            bit = $DecodeBit(rangeDecoder, Models, startIndex + m);
            m <<= 1;
            m += bit;
            symbol |= bit << bitIndex;
        }
        return symbol;
    }
    /** de */
    
    /** ds */
    function $DecodeBit(this$static, probs, index) {
        var newBound, prob = probs[index];
        newBound = (this$static.Range >>> 11) * prob;
        if ((this$static.Code ^ -2147483648) < (newBound ^ -2147483648)) {
            this$static.Range = newBound;
            probs[index] = prob + (2048 - prob >>> 5) << 16 >> 16;
            if (!(this$static.Range & -16777216)) {
                this$static.Code = this$static.Code << 8 | $read(this$static.Stream);
                this$static.Range <<= 8;
            }
            return 0;
        } else {
            this$static.Range -= newBound;
            this$static.Code -= newBound;
            probs[index] = prob - (prob >>> 5) << 16 >> 16;
            if (!(this$static.Range & -16777216)) {
                this$static.Code = this$static.Code << 8 | $read(this$static.Stream);
                this$static.Range <<= 8;
            }
            return 1;
        }
    }
    
    function $DecodeDirectBits(this$static, numTotalBits) {
        var i, t, result = 0;
        for (i = numTotalBits; i != 0; --i) {
            this$static.Range >>>= 1;
            t = this$static.Code - this$static.Range >>> 31;
            this$static.Code -= this$static.Range & t - 1;
            result = result << 1 | 1 - t;
            if (!(this$static.Range & -16777216)) {
                this$static.Code = this$static.Code << 8 | $read(this$static.Stream);
                this$static.Range <<= 8;
            }
        }
        return result;
    }
    
    function $Init_8(this$static) {
        this$static.Code = 0;
        this$static.Range = -1;
        for (var i = 0; i < 5; ++i) {
            this$static.Code = this$static.Code << 8 | $read(this$static.Stream);
        }
    }
    /** de */
    
    function InitBitModels(probs) {
        for (var i = probs.length - 1; i >= 0; --i) {
            probs[i] = 1024;
        }
    }
    
    /** ds */
    function decode(utf) {
        var i = 0, j = 0, x, y, z, l = utf.length, buf = [], charCodes = [];
        for (; i < l; ++i, ++j) {
            x = utf[i] & 255;
            if (!(x & 128)) {
                if (!x) {
                    /// It appears that this is binary data, so it cannot be converted to a string, so just send it back.
                    return utf;
                }
                charCodes[j] = x;
            } else if ((x & 224) == 192) {
                if (i + 1 >= l) {
                    /// It appears that this is binary data, so it cannot be converted to a string, so just send it back.
                    return utf;
                }
                y = utf[++i] & 255;
                if ((y & 192) != 128) {
                    /// It appears that this is binary data, so it cannot be converted to a string, so just send it back.
                    return utf;
                }
                charCodes[j] = ((x & 31) << 6) | (y & 63);
            } else if ((x & 240) == 224) {
                if (i + 2 >= l) {
                    /// It appears that this is binary data, so it cannot be converted to a string, so just send it back.
                    return utf;
                }
                y = utf[++i] & 255;
                if ((y & 192) != 128) {
                    /// It appears that this is binary data, so it cannot be converted to a string, so just send it back.
                    return utf;
                }
                z = utf[++i] & 255;
                if ((z & 192) != 128) {
                    /// It appears that this is binary data, so it cannot be converted to a string, so just send it back.
                    return utf;
                }
                charCodes[j] = ((x & 15) << 12) | ((y & 63) << 6) | (z & 63);
            } else {
                /// It appears that this is binary data, so it cannot be converted to a string, so just send it back.
                return utf;
            }
            if (j == 16383) {
                buf.push(String.fromCharCode.apply(String, charCodes));
                j = -1;
            }
        }
        if (j > 0) {
            charCodes.length = j;
            buf.push(String.fromCharCode.apply(String, charCodes));
        }
        return buf.join("");
    }
    /** de */
    
    
    function toDouble(a) {
        return a[1] + a[0];
    }
    
    
    /** ds */
    function decompress(byte_arr, on_finish, on_progress) {
        var this$static = {},
            percent,
            cbn, /// A callback number should be supplied instead of on_finish() if we are using Web Workers.
            has_progress,
            len,
            sync = typeof on_finish == "undefined" && typeof on_progress == "undefined";

        if (typeof on_finish != "function") {
            cbn = on_finish;
            on_finish = on_progress = 0;
        }
        
        on_progress = on_progress || function(percent) {
            if (typeof cbn == "undefined")
                return;
            
            return update_progress(has_progress ? percent : -1, cbn);
        };
        
        on_finish = on_finish || function(res, err) {
            if (typeof cbn == "undefined")
                return;
            
            return postMessage({
                action: action_decompress,
                cbn: cbn,
                result: res,
                error: err
            });
        };

        if (sync) {
            this$static.d = $LZMAByteArrayDecompressor({}, byte_arr);
            while ($processChunk(this$static.d.chunker));
            return decode($toByteArray(this$static.d.output));
        }
        
        try {
            this$static.d = $LZMAByteArrayDecompressor({}, byte_arr);
            
            len = toDouble(this$static.d.length_0);
            
            ///NOTE: If the data was created via a stream, it will not have a length value, and therefore we can't calculate the progress.
            has_progress = len > -1;
            
            on_progress(0);
        } catch (err) {
            return on_finish(null, err);
        }
        
        function do_action() {
            try {
                var res, i = 0, start = (new Date()).getTime();
                while ($processChunk(this$static.d.chunker)) {
                    if (++i % 1000 == 0 && (new Date()).getTime() - start > 200) {
                        if (has_progress) {
                            percent = toDouble(this$static.d.chunker.decoder.nowPos64) / len;
                            /// If about 200 miliseconds have passed, update the progress.
                            on_progress(percent);
                        }
                        
                        ///NOTE: This allows other code to run, like the browser to update.
                        wait(do_action, 0);
                        return 0;
                    }
                }
                
                on_progress(1);
                
                res = decode($toByteArray(this$static.d.output));
                
                /// delay so we don’t catch errors from the on_finish handler
                wait(on_finish.bind(null, res), 0);
            } catch (err) {
                on_finish(null, err);
            }
        }
        
        ///NOTE: We need to wait to make sure it is always async.
        wait(do_action, 0);
    }
    /** de */
    
    
    /// If we're in a Web Worker, create the onmessage() communication channel.
    ///NOTE: This seems to be the most reliable way to detect this.
    if (typeof onmessage != "undefined" && (typeof window == "undefined" || typeof window.document == "undefined")) {
        (function () {
            /* jshint -W020 */
            /// Create the global onmessage function.
            onmessage = function (e) {
                if (e && e.data) {
                    
                    /// co:if (e.data.action == action_compress) {
                    /// co:    LZMA.compress(e.data.data, e.data.mode, e.data.cbn);
                    /// co:}
                    if (e.data.action == action_decompress) {
                        LZMA.decompress(e.data.data, e.data.cbn);
                    }
                }
            };
        }());
    }
        
    return {
        
        /// co:compress:   compress
        decompress: decompress
    };
}());

/// This is used by browsers that do not support web workers (and possibly Node.js).
commonjsGlobal.LZMA = commonjsGlobal.LZMA_WORKER = LZMA;

class XRAvatar {
    constructor (data) {
        this.data = data;
    }
    async init (Assembler) {
        const gltfPath = this.data.modelURL;
        const assembler = new Assembler(gltfPath);
        this.model = await assembler.assemble(this.data);
    }
}

const dialogStyle = "position: absolute; top: 5vh; left: 5vw; width: 90vw; height: 90vh; border: 2px solid #0A78FC; box-shadow: 10px 10px 10px 0em rgba(0,0,0,0.5);";

class AvatarLoader {
  constructor ( url ) {
    this.apiURL = url;
    this.iframe = null;
    this.comlink = null;
  }
  
  static async decompress (array) {
    return new Promise(resolve => window.LZMA.decompress(array, resolve));
  }

  async getComlink () {
    return this.comlink || await (async () => {
      const comlinkIframe = this.iframe = document.createElement('iframe');
      comlinkIframe.setAttribute('sandbox', "allow-scripts allow-same-origin");
      comlinkIframe.setAttribute('referrerpolicy', "strict-origin");
      comlinkIframe.src = this.apiURL;
      comlinkIframe.setAttribute('style',dialogStyle);
      comlinkIframe.style.visibility = 'hidden';
      document.body.appendChild(comlinkIframe);
      this.comlink = await new Promise((resolve, reject) => {
        comlinkIframe.onload = async function iframeLoaded() {
          const api = wrap(windowEndpoint(comlinkIframe.contentWindow));
          resolve(api);
        };
        comlinkIframe.onerror = function iframeError(e) {
          reject(Error('Iframe failed to load: ' + e.message));
        };
      });
      return this.comlink;
    })()
  }

  async attemptLoad () {
    const api = await this.getComlink();
    console.log(await api.testVal);

    if (await api.canDoLocalStorage()) {
      const hasAvatar = await api.hasAvatar();
      console.log({hasAvatar});
      const hasPermission = await api.hasPermission();
      console.log({hasPermission});
  
      // Everything is all good go ahead and get the avatar
      if (hasAvatar && hasPermission) return {result: true};
      
      // Something went wrong either no avatar or no permission
      // Show the iframe
      this.iframe.style.visibility = '';
  
      try {
        await api.getPermission();
        console.log('Permission Granted!!');
        this.iframe.style.visibility = 'hidden';
        return {result: true};
      } catch (e) {
        this.iframe.style.visibility = 'hidden';
        return {
          result: false,
          message: e.message
        };
      }

    } else {
      // Oh dear the user agent is blocking third party storage
      //No worries we will just have to navigate there instead to get the avatar as a URL encoded string
      const locationBits = new URL(location.href);
      location.assign(this.apiURL + '?redirect=' + encodeURIComponent(locationBits.origin + locationBits.pathname));
      return {
        result: false,
        message: "Redirecting to get avatar"
      }
    }
  }

  static async loadAvatarFromBase64(base64) {
    const string = atob(base64);
    const array = [...string].map(c => c.charCodeAt(0) - 128);
    const json = await AvatarLoader.decompress(array);
    return new XRAvatar(JSON.parse(json));
  }

  async getAvatarAsJSON () {
    const api = await this.getComlink();
    return new XRAvatar(await api.getAvatarAsJSON());
  }

  cleanUp () {
    this.iframe.parentNode.removeChild(this.iframe);
    this.iframe = null;
    this.comlink = null;
  }
}

var common = /* glsl */`
#include <common>
uniform sampler2D xravatar_palette;
uniform float xravatar_offsetx;
uniform float xravatar_offsety;
uniform float xravatar_palettetexelsize;
`;

/*
Tweak the map to use the map as an index rather than as an image

r in image is expressed between 0-1
instead of 0-255

Index = floor(255 * r/16) ~= floor(r * 16);
Brightness = r%16;

Use this to get the colour in HSL format from the array of 16 colours in the uniforms

put into hsl2rgb to get final colour.
*/

var mapFragment = /* glsl */`
#ifdef USE_MAP
    float index;
    float bshift;
    vec4 indexColor;
    vec4 texelColor;
    vec4 outColor = vec4(0.0);

    float pixelSize = 1.0/2048.0;

    // Center the point on the middle of the texel
    vec2 offset = mod(vUv, pixelSize) - (0.5 * pixelSize);
    vec2 vUv1 = vUv - offset;

    // Normalise offset
    vec2 dir = offset/abs(offset);
    offset*=(dir/pixelSize) * 1.33333;

    // Interpolate when the sampled point sits between two texels
    float totalMix = 0.0;
    ${[
        ['vUv1', '1.0'], // Sample center texel
        ['vUv1 + vec2(pixelSize * dir.x, 0.0)', 'offset.x'], // Sample one texel right/left
        ['vUv1 + vec2(0.0, pixelSize * dir.y)', 'offset.y'], // Sample one texel up/down
    ].map(([uvOffset, mix]) => `
        totalMix += ${mix};
        texelColor = texture2D( map,  ${uvOffset} );
        index = floor(texelColor.r * 16.0) / 16.0 + xravatar_palettetexelsize * 0.5; // Between 0 and 1
        bshift = smoothstep(0.0, 0.0625, mod(texelColor.r, 0.0625)); // Between 0 and 1.0
        indexColor = texture2D( xravatar_palette, vec2(index, 1.0 - bshift) );
        outColor += indexColor * ${mix};
    `
    ).join('\n\n')}

    diffuseColor *= mapTexelToLinear(outColor/totalMix);
#endif
`;

const defaultValues = {
    "xravatar_index": 0,
    "xravatar_minCount": 0,
    "xravatar_maxCount": 1,
    "xravatar_minR": 0,
    "xravatar_maxR": 0.7,
    "xravatar_minScale": 0.7,
    "xravatar_maxScale": 1.3,
    "xravatar_canMirror": 1,
    "xravatar_canMove": 0.0,
    "xravatar_defaultMirror": 0
};

const c = document.createElement('canvas');
c.style.width = c.style.height = 'auto';
c.style.transform = 'scale(4) translate(50%,50%)';
// document.body.appendChild(c);
const ctx = c.getContext("2d");

const palettes = [];
const singlePaletteSize = 16;
let sideLength = 0;

let texture;
function getCanvasTexture(CanvasTexture) {
    texture = texture || new CanvasTexture(c);
    return texture
}

function coordinate(index) {
    const sideCapacity = sideLength / singlePaletteSize;
    return [
        (index % sideCapacity) * singlePaletteSize,
        Math.floor(index / sideCapacity) * singlePaletteSize
    ]
}

const buffer = new Uint8ClampedArray(256 * 4);
function draw(ctx, palette, offsetX, offsetY) {
    for (let i=0; i<256;i++) {
        const x=i%singlePaletteSize;
        const y=Math.floor(i/singlePaletteSize);
        const index=x;
        const brightnessshift = 2.0*y/16;
        buffer[i*4 + 0] = palette[index*3 + 0] * brightnessshift;
        buffer[i*4 + 1] = palette[index*3 + 1] * brightnessshift;
        buffer[i*4 + 2] = palette[index*3 + 2] * brightnessshift;
        buffer[i*4 + 3] = 255;
    }
    const id = new ImageData(buffer, singlePaletteSize, singlePaletteSize);
    ctx.putImageData(id,offsetX,offsetY);
}

async function updatePaletteCanvas(uniforms, p, redraw  = false) {
    if (palettes.indexOf(p) === -1) {
        palettes.push(p);
        redraw = true;
    }
    const n = palettes.length;
    const newSideLength = Math.ceil(Math.sqrt(n)) * singlePaletteSize;
    if (newSideLength > sideLength) {
        sideLength = newSideLength;
        redraw = true;
    }
    if (redraw) {
        c.width = c.height = sideLength;
        palettes.forEach((palette, i) => {
            const [x,y] = coordinate(i);
            draw(ctx, palette, x, y);
            if (uniforms.xravatar_offsetx) {
                uniforms.xravatar_offsetx.value = x;
                uniforms.xravatar_offsety.value = y;
                uniforms.xravatar_palettetexelsize.value = 1/sideLength;
            }
            if (texture) texture.needsUpdate = true;
        });
    } else {
        const i = palettes.indexOf(p);
        const palette = palettes[i];
        const [x,y] = coordinate(i);
        draw(ctx, palette, x, y);
        if (uniforms.xravatar_offsetx) {
            uniforms.xravatar_offsetx.value = x;
            uniforms.xravatar_offsety.value = y;
            uniforms.xravatar_palettetexelsize.value = 1/sideLength;
        }
        if (texture) texture.needsUpdate = true;
    }
}

/* global THREE */

function sphericalPolarToCartesian(r, p, t) {
  return [
    r * Math.sin(t) * Math.cos(p),
    r * Math.cos(t),
    r * Math.sin(t) * Math.sin(p),
  ];
}

async function checkURL() {
  const xravatarSearchParam = new URLSearchParams(new URL(location.href).search).get('xravatar');
  if (xravatarSearchParam) {
    const avatar = await AvatarLoader.loadAvatarFromBase64(xravatarSearchParam.replace(/ /gi, '+'));
    return avatar;
  }
}

async function getAvatar(url) {
  const avatarLoader = new AvatarLoader(url);

  // Creates an iframe to get permission or to prompt the user to make an avatar 
  let test = await avatarLoader.attemptLoad();

  if (test.result === false) {

    // removes the iframe
    avatarLoader.cleanUp();
    throw Error(test.message);
  } else if (test.result === true) {

    // Uses the same iframe to load the avatar
    const avatar = await avatarLoader.getAvatarAsJSON();

    // removes the iframe
    avatarLoader.cleanUp();
    return avatar;
  }
}

const assemblerCache = new Map();
class Assembler {
  constructor(gltfPath) {

    // There is one Assembler per gltfPath
    if (assemblerCache.has(gltfPath)) {
      return assemblerCache.get(gltfPath);
    }
    const loader = new THREE.GLTFLoader();
    this.categoriesPromise = new Promise(resolve => loader.load(gltfPath, resolve))
      .then(function ({ scene: gltfScene }) {
        const categories = {};
        const toBeRemoved = [];
        let material;
        let morphMaterial;

        gltfScene.children[0].traverse(o => {
          if (o.type === 'Group') return;

          // Inherit data from parent (or the default values)
          const dataToInherit = o.parent === gltfScene ? defaultValues : o.parent.userData;
          for (const key of Object.keys(defaultValues)) {
            o.userData[key] = (o.userData[key] === undefined ? dataToInherit[key] : o.userData[key]);
          }

          if (!material && o.material && !o.morphTargetDictionary) {
            material = o.material;
          }
          if (!morphMaterial && o.material && o.morphTargetDictionary) {
            morphMaterial = o.material;
            morphMaterial.morphTargets = true;
          }
          if (o.material) {
            if (!o.morphTargetDictionary) o.material = material;
            else o.material = morphMaterial;
          }

          if (!o.geometry) {
            const parent = o.parent === gltfScene ? undefined : o.parent;
            const target = new THREE.Group();
            o.add(target);

            // If it has no geometry it's a category
            categories[o.name] = {
              name: o.name,
              userData: o.userData,
              model: o,
              parent,
              children: {},
              target
            };
          } else {

            o.castShadow = true;
            toBeRemoved.push(o);

            // If it has data add it to category;
            const data = categories[o.parent.name].children[o.name] = ({
              name: o.name,
              model: o,
              userData: o.userData,
              morphTargets: o.morphTargetDictionary && Object.keys(o.morphTargetDictionary)
            });
            if (data.userData.xravatar_canMove) {

              const radius = o.position.length();
              data.startPosition = {
                radius,
                phi: Math.atan2(o.position.z, o.position.x),
                theta: Math.acos(o.position.y / radius)
              };
              o.position.x = 0;
              o.position.y = 0;
              o.position.z = 0;
            }
          }
        });

        /* Tweak the material to enable the map to behave as a HSL indexed colour map rather than as an rgb map */
        const oldOnBeforeCompile = material.onBeforeCompile;
        let uniforms = {
            xravatar_palette: {
                value: getCanvasTexture(THREE.CanvasTexture)
            },
            xravatar_offsetx: {
                value: 0
            },
            xravatar_offsety: {
                value: 0
            },
            xravatar_palettetexelsize: {
                value: 1/16
            }
        };
        morphMaterial.onBeforeCompile = material.onBeforeCompile = function (shader) {
            oldOnBeforeCompile();
            Object.assign(shader.uniforms, uniforms);
            Object.assign(uniforms, shader.uniforms);
            shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', mapFragment);
            shader.fragmentShader = shader.fragmentShader.replace('#include <common>', common);
        };
        material.map.minFilter = material.map.magFilter = THREE.NearestFilter;

        toBeRemoved.forEach(o => o.parent.remove(o));
        // sort the gltf into it's bits
        return {
          xravatar_root: gltfScene.children[0],
          categories,
          uniforms
        };
      });
  }

  async assemble(state) {
    const gltfParsed = await this.categoriesPromise;
    const categories = gltfParsed.categories;
    const xravatar_root = gltfParsed.xravatar_root;
    const categoryNames = Object.keys(categories);
    const uniforms = gltfParsed.uniforms;

    updatePaletteCanvas(uniforms, state.palette);

    for (const categoryName of categoryNames) {
      const item = state[categoryName];
      const category = categories[categoryName];
      const parent = category.target;
      parent.children.splice(0);
      if (!item) continue;
      if (item.children) {
        item.children
          .forEach(item => {
            const model = addItem(categories, parent, categoryName, item);
            applySettings(model, item.settings);
            applyMorph(model, item.settings);

            if (item.settings.xravatar_mirror) {
              const mirrorItem = {};
              Object.assign(mirrorItem, item);
              mirrorItem.settings = {};
              Object.assign(mirrorItem.settings, item.settings);
              mirrorItem.settings.xravatar_flip = !mirrorItem.settings.xravatar_flip;

              const model2 = addItem(categories, parent, categoryName, mirrorItem);
              applySettings(model2, mirrorItem.settings);
              applyMorph(model2, mirrorItem.settings);
            }
          });
      } else if (item.settings.xravatar_mirror) {
        parent.parent.matrix.identity();

        const mirrorItem = {};
        Object.assign(mirrorItem, item);
        mirrorItem.settings = {};
        Object.assign(mirrorItem.settings, item.settings);
        mirrorItem.settings.xravatar_flip = !mirrorItem.settings.xravatar_flip;

        const model = addItem(categories, parent, categoryName, item);
        applySettings(model, item.settings);
        applyMorph(model, item.settings);

        const model2 = addItem(categories, parent, categoryName, mirrorItem);
        applySettings(model2, mirrorItem.settings);
        applyMorph(model2, mirrorItem.settings);

      } else {
        const model = addItem(categories, parent, categoryName, item);
        applySettings(parent.parent, item.settings);
        applyMorph(model, item.settings);
      }
    }
    return xravatar_root.clone(true);
  }
}


const currentlyUsedObjects = new Map();
function addItem(categories, parent, categoryName, item) {
  const cache = currentlyUsedObjects;
  let modelToAdd = cache.get(item);
  const category = categories[categoryName];

  // Fail gracefully on unmatched things from the state
  if (!category) {
    console.warn(`"${categoryName}", from state, not found in GLTF file.`);
    return
  }

  if (!modelToAdd) {
    const child = category.children[item.name];
    if (!child) {
      console.warn(`Child "${item.name}" of ${categoryName}", from state, not found in GLTF file.`);
      return
    }
    modelToAdd = child.model.clone();
    cache.set(item, modelToAdd);
  }
  parent.add(modelToAdd);

  return modelToAdd;
}

function applyMorph(model, settings) {
  // Apply morph targets
  Object.keys(settings)
    .filter(key => key.indexOf('xravatar_morph_') === 0)
    .forEach(key => {
      const morphName = key.slice(15);
      const index = model.morphTargetDictionary[morphName];
      model.morphTargetInfluences[index] = settings[key];
    });
}

let tempMatrix;
function applySettings(model, settings) {
  tempMatrix = tempMatrix || new THREE.Matrix4();
  model.matrixAutoUpdate = false;
  model.matrix.identity();
  const scale = settings.xravatar_scale || 1.0;
  if (settings.xravatar_flip) {
    model.matrix.multiply(tempMatrix.makeScale(
      1.0,
      1.0,
      -1.0
    ));
  }
  const oldPosition = model.oldPosition || (model.oldPosition = model.position.clone());
  if (settings.xravatar_positionRadius) {
    model.matrix.multiply(tempMatrix.makeTranslation(
      ...sphericalPolarToCartesian(
        settings.xravatar_positionRadius,
        settings.xravatar_positionPhi,
        settings.xravatar_positionTheta
      )
    ));
  } else {
    model.matrix.multiply(tempMatrix.makeTranslation(
      oldPosition.x, oldPosition.y, oldPosition.z
    ));
  }
  model.matrix.multiply(tempMatrix.makeScale(
    scale,
    scale,
    scale
  ));
}

export { Assembler, AvatarLoader, checkURL, getAvatar };
//# sourceMappingURL=xravatar.three.js.map
