/* puyo-ai-worker-wasm.js
 * Bridge between pp-sim2 UI and puyoAI_wasm.wasm using factory function
 *
 * Fix:
 * - Emscripten-generated module does not expose HEAP32 publicly by default.
 * - This worker fetches the generated module source, patches updateMemoryViews()
 *   to publish heap views onto Module, then imports the patched source.
 * - locateFile is passed explicitly so puyoAI_wasm.wasm resolves correctly even
 *   when the module is imported from a Blob URL.
 */

let createPuyoAI = null;

async function loadPatchedWasmFactory() {
    if (createPuyoAI) return createPuyoAI;

    const wasmModuleUrl = new URL('./puyoAI_wasm.mjs', import.meta.url);
    const response = await fetch(wasmModuleUrl);

    if (!response.ok) {
        throw new Error(
            `Failed to fetch WASM module source: ${response.status} ${response.statusText}`
        );
    }

    let source = await response.text();

    // Works for both minified and non-minified output.
    const updateMemoryViewsPattern =
        /function updateMemoryViews\(\)\{var b=wasmMemory\.buffer;HEAP8=new Int8Array\(b\);HEAP16=new Int16Array\(b\);HEAPU8=new Uint8Array\(b\);HEAPU16=new Uint16Array\(b\);HEAP32=new Int32Array\(b\);HEAPU32=new Uint32Array\(b\);HEAPF32=new Float32Array\(b\);HEAPF64=new Float64Array\(b\);HEAP64=new BigInt64Array\(b\);HEAPU64=new BigUint64Array\(b\)\}/;

    const replacement =
        'function updateMemoryViews(){var b=wasmMemory.buffer;HEAP8=new Int8Array(b);HEAP16=new Int16Array(b);HEAPU8=new Uint8Array(b);HEAPU16=new Uint16Array(b);HEAP32=new Int32Array(b);HEAPU32=new Uint32Array(b);HEAPF32=new Float32Array(b);HEAPF64=new Float64Array(b);HEAP64=new BigInt64Array(b);HEAPU64=new BigUint64Array(b);Module["HEAP8"]=HEAP8;Module["HEAP16"]=HEAP16;Module["HEAP32"]=HEAP32;Module["HEAPU8"]=HEAPU8;Module["HEAPU16"]=HEAPU16;Module["HEAPU32"]=HEAPU32;Module["HEAPF32"]=HEAPF32;Module["HEAPF64"]=HEAPF64;Module["HEAP64"]=HEAP64;Module["HEAPU64"]=HEAPU64;Module["wasmMemory"]=wasmMemory;}';

    if (!updateMemoryViewsPattern.test(source)) {
        throw new Error(
            'Failed to patch WASM source: updateMemoryViews() pattern not found'
        );
    }

    source = source.replace(updateMemoryViewsPattern, replacement);

    const blob = new Blob([source], { type: 'text/javascript' });
    const blobUrl = URL.createObjectURL(blob);

    try {
        const mod = await import(blobUrl);
        createPuyoAI = mod.default;
        return createPuyoAI;
    } finally {
        URL.revokeObjectURL(blobUrl);
    }
}

let aiInstance = null;
let aiChooseMove = null;

function log(msg) {
    self.postMessage({ action: 'LOG', message: msg });
}

function getHeap32(instance) {
    if (instance.HEAP32) return instance.HEAP32;

    const memory =
        instance.wasmMemory ||
        instance.memory ||
        instance.asm?.memory;

    if (memory && memory.buffer) {
        instance.HEAP32 = new Int32Array(memory.buffer);
        return instance.HEAP32;
    }

    return null;
}

// Initialize WASM Module
async function initWasm() {
    log('WASM Module factory initialization started...');
    try {
        const createFactory = await loadPatchedWasmFactory();

        // IMPORTANT:
        // This fixes "puyoAI_wasm.wasm cannot be parsed as a URL."
        // The wasm file is resolved from the real module location, not the Blob URL.
        const module = await createFactory({
            locateFile: (path) => new URL(path, wasmModuleUrl).href
        });

        aiInstance = module;

        if (typeof aiInstance.cwrap === 'function') {
            aiChooseMove = aiInstance.cwrap(
                'ai_choose_move',
                'number',
                ['number', 'number', 'number', 'number', 'number']
            );

            if (!getHeap32(aiInstance)) {
                throw new Error('HEAP32 unavailable after module init');
            }

            log('WASM AI Initialized successfully');
        } else {
            log('CRITICAL ERROR: cwrap not found on WASM module');
        }
    } catch (e) {
        log('CRITICAL ERROR: Factory initialization failed: ' + e.message);
        console.error(e);
    }
}

const wasmInitPromise = initWasm();

self.onmessage = async function (e) {
    await wasmInitPromise;

    if (!aiInstance || !aiChooseMove) {
        log('ERROR: AI Instance or ChooseMove function not ready');
        return;
    }

    const { boardBuffer, pieceBuffer } = e.data;

    try {
        const HEAP32 = getHeap32(aiInstance);
        if (!HEAP32) {
            log('ERROR: HEAP32 is unavailable');
            return;
        }

        const boardPtr = aiInstance._malloc(boardBuffer.length * 4);
        if (!boardPtr) {
            log('ERROR: Failed to allocate memory in WASM');
            return;
        }

        try {
            HEAP32.set(boardBuffer, boardPtr >> 2);

            const result = aiChooseMove(
                boardPtr,
                pieceBuffer[1], // sub1
                pieceBuffer[0], // main1
                pieceBuffer[3], // sub2
                pieceBuffer[2]  // main2
            );

            const x = Math.floor(result / 10);
            const rot = result % 10;

            self.postMessage({
                action: 'THINK_DONE',
                x: x,
                rotation: rot
            });
        } finally {
            aiInstance._free(boardPtr);
        }
    } catch (err) {
        log('ERROR during WASM execution: ' + err.message);
        console.error(err);
    }
};