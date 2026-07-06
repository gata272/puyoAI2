/* puyo-ai-worker-wasm.js
 * GTR-Only AI Bridge
 */

import createPuyoAI from './puyoAI_wasm.mjs';

let aiInstance = null;
let aiChooseMoveV2 = null;
let resetTurnCount = null;

function log(msg) {
    self.postMessage({ action: 'LOG', message: msg });
}

async function initWasm() {
    log("WASM Module factory initialization started...");
    try {
        const module = await createPuyoAI();
        aiInstance = module;
        aiChooseMoveV2 = aiInstance.cwrap('ai_choose_move_v2', 'number', ['number', 'number', 'number', 'number', 'number', 'number']);
        resetTurnCount = aiInstance.cwrap('reset_turn_count', null, []);
        log("WASM GTR-Only AI Initialized successfully");
    } catch (e) {
        log("CRITICAL ERROR: Factory initialization failed: " + e.message);
    }
}

const wasmInitPromise = initWasm();

self.onmessage = async function(e) {
    await wasmInitPromise;
    
    const { action, pieceBuffer } = e.data;

    if (action === 'RESET_TURN') {
        resetTurnCount();
        log("AI Turn count reset");
        return;
    }

    try {
        // Call AI with 3 pieces (current, next, next-next)
        const result = aiChooseMoveV2(
            pieceBuffer[1], // sub1
            pieceBuffer[0], // main1
            pieceBuffer[3], // sub2
            pieceBuffer[2], // main2
            pieceBuffer[5], // sub3
            pieceBuffer[4]  // main3
        );

        if (result === -1) {
            log("GTR Pattern finished or not found. AI stopping.");
            return;
        }

        const x = Math.floor(result / 10);
        const rot = result % 10;

        self.postMessage({
            action: 'THINK_DONE',
            x: x,
            rotation: rot
        });
    } catch (err) {
        log("ERROR during WASM execution: " + err.message);
    }
};
