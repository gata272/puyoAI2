/* puyo-ai-worker-wasm.js
 * Bridge between pp-sim2 UI and puyoAI_wasm.wasm
 */

import puyoAIModule from './puyoAI_wasm.mjs';

let aiInstance = null;
let aiChooseMove = null;

// Initialize WASM Module
async function initWasm() {
    try {
        const module = await puyoAIModule();
        aiInstance = module;
        // cwrap: function name, return type, argument types
        aiChooseMove = module.cwrap('ai_choose_move', 'number', ['number', 'number', 'number', 'number', 'number']);
        console.log("WASM AI Initialized");
    } catch (e) {
        console.error("Failed to initialize WASM AI:", e);
    }
}

const wasmInitPromise = initWasm();

self.onmessage = async function(e) {
    await wasmInitPromise;
    if (!aiChooseMove) {
        console.error("AI ChooseMove function not ready");
        return;
    }

    const { boardBuffer, pieceBuffer } = e.data;
    
    // boardBuffer: Int32Array(84) - 6x14 board
    // pieceBuffer: Int32Array(6) - [main1, sub1, main2, sub2, main3, sub3]

    // Allocate memory in WASM for board data (Int32Array)
    const boardPtr = aiInstance._malloc(boardBuffer.length * 4); // int is 4 bytes
    
    // Copy data to WASM heap
    aiInstance.HEAP32.set(boardBuffer, boardPtr >> 2);

    // Call AI
    // int ai_choose_move(int* boardData, int subColor, int mainColor, int nextSub, int nextMain)
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
};
