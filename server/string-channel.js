"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
function generateUID() {
    return new Array(4)
        .fill(0)
        .map(() => Math.floor(Math.random() * Number.MAX_SAFE_INTEGER).toString(16))
        .join("-");
}
function* iterateAllProperties(value, path = [], visited = new WeakSet()) {
    if (value === undefined)
        return;
    if (visited.has(value))
        return;
    if (typeof value === "string")
        return;
    if (typeof value === "object")
        visited.add(value);
    yield { value, path };
    // Emit these objects, but don’t traverse them.
    if (ArrayBuffer.isView(value))
        return;
    if (value instanceof ArrayBuffer)
        return;
    const keys = Object.keys(value);
    for (const key of keys) {
        yield* iterateAllProperties(value[key], [...path, key], visited);
    }
}
function findAllTransferables(obj) {
    const transferables = [];
    for (const entry of iterateAllProperties(obj)) {
        if (isTransferable(entry.value)) {
            transferables.push(entry);
        }
    }
    return transferables;
}
function replaceValueAtPath(value, path, newValue) {
    const lastProp = path[path.length - 1];
    for (const prop of path.slice(0, -1)) {
        value = value[prop];
    }
    const oldValue = value[lastProp];
    value[lastProp] = newValue;
    return oldValue;
}
function padLeft(str, pad, length) {
    return (pad.repeat(length) + str).slice(-length);
}
function hexEncode(buffer) {
    return [...new Uint8Array(buffer)]
        .map(v => padLeft(v.toString(16), "0", 2))
        .join("");
}
function hexDecode(s) {
    return new Uint8Array(s
        .split(/(..)/)
        .filter(Boolean)
        .map(v => parseInt(v, 16))).buffer;
}
function addMessageListener(target, listener) {
    if ("on" in target) {
        return target.on("message", (data) => listener({ data }));
    }
    target.addEventListener("message", listener);
}
function getTypedArrayType(v) {
    if (!ArrayBuffer.isView(v)) {
        return 0 /* Raw */;
    }
    if (v instanceof Int8Array) {
        return 1 /* Int8 */;
    }
    if (v instanceof Uint8Array) {
        return 2 /* Uint8 */;
    }
    if (v instanceof Uint8ClampedArray) {
        return 3 /* Uint8Clamped */;
    }
    if (v instanceof Int16Array) {
        return 4 /* Int16 */;
    }
    if (v instanceof Uint16Array) {
        return 5 /* Uint16 */;
    }
    if (v instanceof Int32Array) {
        return 6 /* Int32 */;
    }
    if (v instanceof Uint32Array) {
        return 7 /* Uint32 */;
    }
    if (v instanceof Float32Array) {
        return 8 /* Float32 */;
    }
    if (v instanceof Float64Array) {
        return 9 /* Float64 */;
    }
    if (v instanceof BigInt64Array) {
        return 10 /* BigInt64 */;
    }
    if (v instanceof BigUint64Array) {
        return 11 /* BigUint64 */;
    }
    throw Error("Unknown ArrayBufferView type");
}
function getTypedViewConstructor(type) {
    switch (type) {
        case 0 /* Raw */:
            return v => v;
        case 1 /* Int8 */:
            return v => new Int8Array(v);
        case 2 /* Uint8 */:
            return v => new Uint8Array(v);
        case 3 /* Uint8Clamped */:
            return v => new Uint8ClampedArray(v);
        case 4 /* Int16 */:
            return v => new Int16Array(v);
        case 5 /* Uint16 */:
            return v => new Uint16Array(v);
        case 6 /* Int32 */:
            return v => new Int32Array(v);
        case 7 /* Uint32 */:
            return v => new Uint32Array(v);
        case 8 /* Float32 */:
            return v => new Float32Array(v);
        case 9 /* Float64 */:
            return v => new Float64Array(v);
        case 10 /* BigInt64 */:
            return v => new BigInt64Array(v);
        case 11 /* BigUint64 */:
            return v => new BigUint64Array(v);
    }
}
const messagePortMap = new Map();
function makeTransferable(v, ep) {
    if (v instanceof MessagePort) {
        const uid = generateUID();
        messagePortMap.set(uid, ep);
        const wrapped = wrap(ep, uid);
        addMessageListener(v, ({ data }) => {
            wrapped.postMessage(data, findAllTransferables(data).map(v => v.value));
        });
        v.start();
        addMessageListener(wrapped, ({ data }) => {
            v.postMessage(data, findAllTransferables(data).map(v => v.value));
        });
        return {
            type: 0 /* MessagePort */,
            path: [],
            value: uid
        };
    }
    else if (v instanceof ArrayBuffer || ArrayBuffer.isView(v)) {
        const buffer = v.buffer || v;
        return {
            type: 1 /* TypedArray */,
            subtype: getTypedArrayType(v),
            path: [],
            value: hexEncode(buffer)
        };
    }
    throw Error("Not transferable");
}
function isTransferable(v) {
    if (v instanceof MessagePort) {
        return true;
    }
    if (v instanceof ArrayBuffer) {
        return true;
    }
    if (ArrayBuffer.isView(v)) {
        return true;
    }
    return false;
}
function deserializeTransferable(transfer, ep) {
    switch (transfer.type) {
        case 0 /* MessagePort */:
            const port = wrap(ep, transfer.value);
            return [port, port];
        case 1 /* TypedArray */:
            const constructor = getTypedViewConstructor(transfer.subtype);
            const buffer = hexDecode(transfer.value);
            return [constructor(buffer), buffer];
        default:
            throw Error("Unknown transferable");
    }
}
function wrap(ep, uid = "") {
    const { port1, port2 } = new MessageChannel();
    ep.addMessageListener(msg => {
        let payload;
        payload = JSON.parse(msg);
        if (payload.uid !== uid) {
            return;
        }
        const transferables = payload.transfer
            .map(transfer => {
            const [replacement, transferable] = deserializeTransferable(transfer, ep);
            replaceValueAtPath(payload.data, transfer.path, replacement);
            return transferable;
        })
            .filter(Boolean);
        port2.postMessage(payload.data, transferables);
    });
    addMessageListener(port2, ({ data }) => {
        const transfer = [];
        for (const { path } of findAllTransferables(data)) {
            const oldValue = replaceValueAtPath(data, path, null);
            const serializedTransferable = makeTransferable(oldValue, ep);
            serializedTransferable.path = path;
            transfer.push(serializedTransferable);
        }
        ep.send(JSON.stringify({ uid, data, transfer }));
    });
    port2.start();
    return port1;
}
exports.wrap = wrap;
