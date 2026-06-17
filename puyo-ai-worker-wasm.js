/* puyo-ai-worker-wasm.js
 * Bridge between pp-sim2 UI and puyoAI_wasm.wasm with robust initialization
 */

import puyoAIModule from './puyoAI_wasm.mjs';

let aiInstance = null;
let aiChooseMove = null;

function log(msg) {
    self.postMessage({ action: 'LOG', message: msg });
}

// Initialize WASM Module
async function initWasm() {
    log("WASM Module loading started...");
    try {
        // Emscripten's ES6 module returns a promise that resolves to the module instance
        const module = await puyoAIModule();
        
        // Wait a tiny bit to ensure all internal properties are attached
        await new Promise(resolve => setTimeout(resolve, 100));
        
        aiInstance = module;
        
        // Check if HEAP32 is available
        if (!aiInstance.HEAP32) {
            log("WARNING: HEAP32 not found on module, checking alternative...");
            // Sometimes it's under 'asm' or just needs a moment
        }

        aiChooseMove = module.cwrap('ai_choose_move', 'number', ['number', 'number', 'number', 'number', 'number']);
        log("WASM AI Initialized successfully. HEAP status: " + (!!aiInstance.HEAP32));
    } catch (e) {
        log("CRITICAL ERROR: Failed to initialize WASM AI: " + e.message);
        console.error(e);
    }
}

const wasmInitPromise = initWasm();

self.onmessage = async function(e) {
    await wasmInitPromise;
    
    if (!aiInstance || !aiChooseMove) {
        log("ERROR: AI Instance or ChooseMove function not ready");
        return;
    }

    const { boardBuffer, pieceBuffer } = e.data;
    // log("Worker received think request. Piece: " + pieceBuffer[0] + "," + pieceBuffer[1]);

    try {
        // Ensure HEAP32 is accessible
        const heap = aiInstance.HEAP32;
        if (!heap) {
            log("ERROR: HEAP32 is still undefined during execution");
            return;
        }

        // Allocate memory in WASM for board data (Int32Array)
        const boardPtr = aiInstance._malloc(boardBuffer.length * 4);
        if (!boardPtr) {
            log("ERROR: Failed to allocate memory in WASM");
            return;
        }
        
        // Copy data to WASM heap
        // Use the latest heap reference
        aiInstance.HEAP32.set(boardBuffer, boardPtr >> 2);

        // Call AI
        // log("Calling WASM ai_choose_move...");
        const result = aiChooseMove(
            boardPtr,
            pieceBuffer[1], // sub1
            pieceBuffer[0], // main1
            pieceBuffer[3], // sub2
            pieceBuffer[2]  // main2
        );
        // log("WASM call returned: " + result);

        // Free memory
        aiInstance._free(boardPtr);

        // Parse result: x * 10 + rot
        const x = Math.floor(result / 10);
        const rot = result % 10;

        self.postMessage({
            action: 'THINK_DONE',
            x: x,
            rotation: rot
        });
    } catch (err) {
        log("ERROR during WASM execution: " + err.message);
        console.error(err);
    }
};
