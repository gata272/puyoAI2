/* puyo-ai-worker-wasm.js
 * GTR-Only AI Bridge
 */

import createPuyoAI from './puyoAI_wasm.mjs';

let aiInstance = null;
let aiChooseMoveV2 = null;
let resetTurnCount = null;
let getLockedPatternName = null; // ★追加：型名取得用の関数ポインタ

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
        
        // ★追加：C++の型名取得関数をラップ（戻り値は文字列 'string'）
        getLockedPatternName = aiInstance.cwrap('get_locked_pattern_name', 'string', []);
        
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

            // ★追加：C++側から現在のロックされた型名を取得
            let patternName = "";
            if (getLockedPatternName) {
                patternName = getLockedPatternName();
            }

            self.postMessage({
                action: 'THINK_DONE',
                x: x,
                rotation: rot,
                patternName: patternName // ★追加：メインスレッドへデータを送る
            });
        } catch (err) {
            log("ERROR during WASM execution: " + err.message);
        }
    }
};
