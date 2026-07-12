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
        aiChooseMoveV2 = aiInstance.cwrap(
            'ai_choose_move_v2',
            'number',
            ['number', ['number', 'number', 'number', 'number', 'number', 'number']]
        );
        resetTurnCount = aiInstance.cwrap('reset_turn_count', null, []);
        log("WASM GTR-Only AI Initialized successfully");
    } catch (e) {
        log("CRITICAL ERROR: Factory initialization failed: " + e.message);
    }
}

const wasmInitPromise = initWasm();

self.onmessage = async function(e) {
    await wasmInitPromise;

    const { action, pieceBuffer, turn } = e.data;

    if (action === 'RESET_TURN') {
        if (resetTurnCount) {
            resetTurnCount();
        }
        log("AI Turn count reset");
        return;
    }

    if (action === 'THINK') {
        try {
            const result = aiChooseMoveV2(
                turn,
                pieceBuffer[1], pieceBuffer[0], // p1 sub, main
                pieceBuffer[3], pieceBuffer[2], // p2 sub, main
                pieceBuffer[5], pieceBuffer[4]  // p3 sub, main
            );

            if (result === -1) {
                log("GTR Pattern finished or not found.");
                return;
            }

            // Result format: x * 10 + rot
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
    }
};
