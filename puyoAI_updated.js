/* puyoAI_updated.js
 * Updated to support WASM worker for pp-sim2
 */
(function (global) {
  'use strict';

  const AI_CONFIG = {
    WORKER_PATH: './puyo-ai-worker-wasm.js',
    AUTO_TICK_MS: 200,
    THINK_TIMEOUT_MS: 12000
  };

  const STATE = {
    worker: null,
    workerReady: false,
    autoEnabled: false,
    autoTimer: null,
    busy: false,
    jobSeq: 0
  };

  function initWorker() {
    if (STATE.worker) return;
    try {
      // Use module type for ES6 import in worker
      STATE.worker = new Worker(AI_CONFIG.WORKER_PATH, { type: 'module' });
      STATE.worker.onmessage = handleWorkerMessage;
      STATE.workerReady = true;
      console.log("WASM AI Worker initialized");
    } catch (e) {
      console.error("Failed to start WASM Worker:", e);
    }
  }

  function handleWorkerMessage(e) {
    const data = e.data;
    if (data.action === 'THINK_DONE') {
      STATE.busy = false;
      updateStatus("AI 思考完了");
      
      // Execute move in puyoSim.js
      if (typeof global.executeAIMove === 'function') {
        global.executeAIMove(data.x, data.rotation);
      } else {
        // Fallback: manually trigger drop if executeAIMove is not exposed
        console.log("AI Move:", data.x, data.rotation);
        // In pp-sim2, we might need to simulate key presses or call internal functions
        if (global.currentPuyo) {
            global.currentPuyo.x = data.x;
            global.currentPuyo.rotation = data.rotation;
            if (typeof global.hardDrop === 'function') global.hardDrop();
        }
      }
    }
  }

  function updateStatus(text) {
    const el = document.getElementById('ai-status');
    if (el) el.textContent = text;
  }

  function think() {
    if (!STATE.workerReady || STATE.busy) return;
    if (global.gameState !== 'playing' || !global.currentPuyo) return;

    // Prepare board data for WASM
    const board = global.board; 
    const nextQueue = global.nextQueue;
    const queueIndex = global.queueIndex;
    const currentPuyo = global.currentPuyo;

    if (!board || !currentPuyo) return;

    const flatBoard = new Uint8Array(6 * 14);
    for (let y = 0; y < 14; y++) {
      for (let x = 0; x < 6; x++) {
        flatBoard[y * 6 + x] = board[y][x];
      }
    }

    const pieces = new Uint8Array(6);
    pieces[0] = currentPuyo.mainColor;
    pieces[1] = currentPuyo.subColor;
    
    // Get next pieces from queue
    if (nextQueue && nextQueue[queueIndex]) {
      pieces[2] = nextQueue[queueIndex][1]; // main
      pieces[3] = nextQueue[queueIndex][0]; // sub
    }

    STATE.busy = true;
    updateStatus("AI 思考中...");
    STATE.worker.postMessage({
      boardBuffer: flatBoard,
      pieceBuffer: pieces
    });
  }

  // Global API for UI
  global.toggleAI = function() {
    STATE.autoEnabled = !STATE.autoEnabled;
    if (STATE.autoEnabled) {
      initWorker();
      STATE.autoTimer = setInterval(think, AI_CONFIG.AUTO_TICK_MS);
      updateStatus("AI 自動モード: ON");
    } else {
      clearInterval(STATE.autoTimer);
      updateStatus("AI 自動モード: OFF");
    }
    updateUI();
  };

  function updateUI() {
    const btn = document.getElementById('ai-auto-button');
    if (btn) {
        btn.textContent = STATE.autoEnabled ? 'AI: ON' : 'AI: OFF';
        btn.style.backgroundColor = STATE.autoEnabled ? '#27ae60' : '#8e44ad';
    }
  }

})(window);
