/* puyo-ai-worker-wasm.js
 * Bridge between pp-sim2 UI and puyoAI_wasm.wasm using factory function
 */

import createPuyoAI from './puyoAI_wasm.mjs';

let aiInstance = null;
let aiChooseMove = null;

function log(msg) {
    self.postMessage({ action: 'LOG', message: msg });
}

// Initialize WASM Module
async function initWasm() {
    log("WASM Module factory initialization started...");
    try {
        // Use the exported factory function
        const module = await createPuyoAI();
        aiInstance = module;
        
        // Ensure HEAP32 is available
        if (aiInstance.HEAP32) {
            aiChooseMove = aiInstance.cwrap('ai_choose_move', 'number', ['number', 'number', 'number', 'number', 'number']);
            log("WASM AI Initialized successfully with HEAP32");
        } else {
            log("CRITICAL ERROR: HEAP32 still not found even after factory init");
        }
    } catch (e) {
        log("CRITICAL ERROR: Factory initialization failed: " + e.message);
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

    try {
        // Allocate memory in WASM for board data (Int32Array)
        const boardPtr = aiInstance._malloc(boardBuffer.length * 4);
        if (!boardPtr) {
            log("ERROR: Failed to allocate memory in WASM");
            return;
        }
        
        // Copy data to WASM heap
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
