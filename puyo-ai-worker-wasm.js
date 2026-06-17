/* puyo-ai-worker-wasm.js
 * Bridge between pp-sim2 UI and puyoAI_wasm.wasm using factory function
 *
 * Fix:
 * - Emscripten-generated module does not expose HEAP32 publicly by default.
 * - This worker fetches the generated module source, patches updateMemoryViews()
 *   to publish heap views onto Module, then imports the patched source.
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

    // This marker matches the current generated puyoAI_wasm.mjs source.
    // If the WASM module is regenerated and this string changes, patching must be updated.
    const needle = 'HEAPU64=new BigUint64Array(b)}function preRun()';
    const replacement = [
        'HEAPU64=new BigUint64Array(b);',
        'Module["HEAP8"]=HEAP8;',
        'Module["HEAP16"]=HEAP16;',
        'Module["HEAP32"]=HEAP32;',
        'Module["HEAPU8"]=HEAPU8;',
        'Module["HEAPU16"]=HEAPU16;',
        'Module["HEAPU32"]=HEAPU32;',
        'Module["HEAPF32"]=HEAPF32;',
        'Module["HEAPF64"]=HEAPF64;',
        'Module["HEAP64"]=HEAP64;',
        'Module["HEAPU64"]=HEAPU64;',
        'Module["wasmMemory"]=wasmMemory;',
        '}function preRun()'
    ].join('');

    if (!source.includes(needle)) {
        throw new Error(
            'Failed to patch WASM source: expected heap-view marker not found'
        );
    }

    source = source.replace(needle, replacement);

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

// Initialize WASM Module
async function initWasm() {
    log('WASM Module factory initialization started...');
    try {
        const createFactory = await loadPatchedWasmFactory();
        const module = await createFactory();
        aiInstance = module;

        // cwrap が使えることを初期化成功の基準にする
        if (typeof aiInstance.cwrap === 'function') {
            // HEAP32 が公開されていない場合は、公開された memory から生成する
            if (!aiInstance.HEAP32) {
                const memory =
                    aiInstance.wasmMemory ||
                    aiInstance.memory ||
                    aiInstance.asm?.memory;

                if (memory && memory.buffer) {
                    aiInstance.HEAP32 = new Int32Array(memory.buffer);
                }
            }

            aiChooseMove = aiInstance.cwrap(
                'ai_choose_move',
                'number',
                ['number', 'number', 'number', 'number', 'number']
            );

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
        if (!aiInstance.HEAP32) {
            const memory =
                aiInstance.wasmMemory ||
                aiInstance.memory ||
                aiInstance.asm?.memory;

            if (memory && memory.buffer) {
                aiInstance.HEAP32 = new Int32Array(memory.buffer);
            }
        }

        if (!aiInstance.HEAP32) {
            log('ERROR: HEAP32 is unavailable');
            return;
        }

        // Allocate memory in WASM for board data (Int32Array)
        const boardPtr = aiInstance._malloc(boardBuffer.length * 4);
        if (!boardPtr) {
            log('ERROR: Failed to allocate memory in WASM');
            return;
        }

        try {
            // Copy data to WASM heap
            aiInstance.HEAP32.set(boardBuffer, boardPtr >> 2);

            // Call AI
            const result = aiChooseMove(
                boardPtr,
                pieceBuffer[1], // sub1
                pieceBuffer[0], // main1
                pieceBuffer[3], // sub2
                pieceBuffer[2]  // main2
            );

            // Parse result: x * 10 + rot
            const x = Math.floor(result / 10);
            const rot = result % 10;

            self.postMessage({
                action: 'THINK_DONE',
                x: x,
                rotation: rot
            });
        } finally {
            // Free memory
            aiInstance._free(boardPtr);
        }
    } catch (err) {
        log('ERROR during WASM execution: ' + err.message);
        console.error(err);
    }
};
