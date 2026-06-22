/* puyo-ai-worker-wasm.js
 * Bridge between pp-sim2 UI and puyoAI_wasm.wasm with GTR & Color Normalization
 */

import createPuyoAI from './puyoAI_wasm.mjs';

let aiInstance = null;
let setBoardCell = null;
let aiChooseMoveV2 = null;
let resetTurnCount = null;

function log(msg) {
    self.postMessage({ action: 'LOG', message: msg });
}

// Initialize WASM Module
async function initWasm() {
    log("WASM Module factory initialization started...");
    try {
        const module = await createPuyoAI();
        aiInstance = module;
        
        setBoardCell = aiInstance.cwrap('set_board_cell', null, ['number', 'number']);
        aiChooseMoveV2 = aiInstance.cwrap('ai_choose_move_v2', 'number', ['number', 'number', 'number', 'number']);
        resetTurnCount = aiInstance.cwrap('reset_turn_count', null, []);
        
        log("WASM AI Initialized successfully with GTR & Color Normalization API");
    } catch (e) {
        log("CRITICAL ERROR: Factory initialization failed: " + e.message);
        console.error(e);
    }
}

const wasmInitPromise = initWasm();

self.onmessage = async function(e) {
    await wasmInitPromise;
    
    if (!aiChooseMoveV2 || !setBoardCell) {
        log("ERROR: AI API functions not ready");
        return;
    }

    const { action, boardBuffer, pieceBuffer } = e.data;

    if (action === 'RESET_TURN') {
        resetTurnCount();
        log("AI Turn count reset");
        return;
    }

    try {
        // Transfer board data
        for (let i = 0; i < boardBuffer.length; i++) {
            setBoardCell(i, boardBuffer[i]);
        }

        // Call AI with current and next pieces
        const result = aiChooseMoveV2(
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
    } catch (err) {
        log("ERROR during WASM execution: " + err.message);
        console.error(err);
    }
};
