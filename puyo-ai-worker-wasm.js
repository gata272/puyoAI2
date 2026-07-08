/* puyo-ai-worker-wasm.js
 * GTR-Only AI Bridge with Pattern Logging
 */

import createPuyoAI from './puyoAI_wasm.mjs';

let aiInstance = null;
let aiChooseMoveV2 = null;
let resetTurnCount = null;

const PATTERN_NAMES = ["NONE", "AAAB型", "AABB型", "ABAB型", "ABAC型", "AABC型", "ABCC型"];

function log(msg) {
    self.postMessage({ action: 'LOG', message: msg });
}

async function initWasm() {
    log("WASM Module factory initialization started...");
    try {
        const module = await createPuyoAI();
        aiInstance = module;
        // Confirm functions exist before cwrap
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
        const result = aiChooseMoveV2(
            pieceBuffer[1], pieceBuffer[0],
            pieceBuffer[3], pieceBuffer[2],
            pieceBuffer[5], pieceBuffer[4]
        );

        if (result === -1) {
            log("GTR Pattern finished or not found.");
            return;
        }

        // Parse result: (x * 100) + (rot * 10) + patternType
        const x = Math.floor(result / 100);
        const rot = Math.floor((result % 100) / 10);
        const typeIdx = result % 10;

        if (typeIdx > 0) {
            log("Pattern Detected: " + PATTERN_NAMES[typeIdx]);
        }

        self.postMessage({
            action: 'THINK_DONE',
            x: x,
            rotation: rot,
            patternName: PATTERN_NAMES[typeIdx]
        });
    } catch (err) {
        log("ERROR during WASM execution: " + err.message);
    }
};
