/* puyoAI_updated.js
 * Updated to support WASM worker for pp-sim2 with extensive logging
 */
(function (global) {
  'use strict';

  const AI_CONFIG = {
    WORKER_PATH: './puyo-ai-worker-wasm.js',
    AUTO_TICK_MS: 500, // Slightly slower for easier debugging
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
    console.log("[AI] Initializing Worker from:", AI_CONFIG.WORKER_PATH);
    try {
      STATE.worker = new Worker(AI_CONFIG.WORKER_PATH, { type: 'module' });
      STATE.worker.onmessage = handleWorkerMessage;
      STATE.worker.onerror = (err) => console.error("[AI] Worker Error:", err);
      STATE.workerReady = true;
      console.log("[AI] Worker object created successfully");
    } catch (e) {
      console.error("[AI] Failed to start WASM Worker:", e);
    }
  }

  function handleWorkerMessage(e) {
    const data = e.data;
    console.log("[AI] Message from Worker:", data);
    
    if (data.action === 'THINK_DONE') {
      STATE.busy = false;
      updateStatus("AI 思考完了: x=" + data.x + ", rot=" + data.rotation);
      executeMove(data.x, data.rotation);
    } else if (data.action === 'LOG') {
      console.log("[AI Worker Log]:", data.message);
    }
  }

  function executeMove(targetX, targetRotation) {
    // Try to find global variables even if they are not on 'window'
    const board = global.board || window.board;
    const currentPuyo = global.currentPuyo || window.currentPuyo;
    const gameState = global.gameState || window.gameState;

    console.log("[AI] Executing Move. State:", gameState, "Puyo:", !!currentPuyo);

    if (gameState !== 'playing' || !currentPuyo) {
        console.warn("[AI] Cannot execute move: Not in playing state or no current puyo");
        return;
    }

    try {
        console.log("[AI] Setting Puyo: x=" + targetX + ", rot=" + targetRotation);
        currentPuyo.rotation = targetRotation;
        currentPuyo.mainX = targetX;

        if (typeof global.hardDrop === 'function') {
            console.log("[AI] Calling global.hardDrop()");
            global.hardDrop();
        } else if (typeof window.hardDrop === 'function') {
            console.log("[AI] Calling window.hardDrop()");
            window.hardDrop();
        } else {
            console.warn("[AI] hardDrop function not found, attempting manual lock");
            if (typeof global.movePuyo === 'function') {
                while (global.movePuyo(0, -1, undefined, false)) { }
                if (typeof global.lockPuyo === 'function') global.lockPuyo();
            }
        }
    } catch (err) {
        console.error("[AI] Error during move execution:", err);
    }
  }

  function updateStatus(text) {
    console.log("[AI Status Update]:", text);
    const el = document.getElementById('ai-status');
    if (el) el.textContent = text;
  }

  function think() {
    if (!STATE.workerReady) {
        console.warn("[AI] Worker not ready yet");
        return;
    }
    if (STATE.busy) {
        console.log("[AI] Still busy thinking...");
        return;
    }

    const board = global.board || window.board;
    const nextQueue = global.nextQueue || window.nextQueue;
    const queueIndex = global.queueIndex || window.queueIndex;
    const currentPuyo = global.currentPuyo || window.currentPuyo;
    const gameState = global.gameState || window.gameState;

    if (gameState !== 'playing' || !currentPuyo) return;

    console.log("[AI] Starting thinking process...");

    try {
        const flatBoard = new Int32Array(6 * 14);
        for (let y = 0; y < 14; y++) {
          for (let x = 0; x < 6; x++) {
            flatBoard[y * 6 + x] = board[y][x];
          }
        }

        const pieces = new Int32Array(6);
        pieces[0] = currentPuyo.mainColor;
        pieces[1] = currentPuyo.subColor;
        
        if (nextQueue && nextQueue[queueIndex]) {
          pieces[2] = nextQueue[queueIndex][1]; // main
          pieces[3] = nextQueue[queueIndex][0]; // sub
        }

        STATE.busy = true;
        updateStatus("AI 思考中...");
        console.log("[AI] Sending data to Worker. Board size:", flatBoard.length);
        STATE.worker.postMessage({
          boardBuffer: flatBoard,
          pieceBuffer: pieces
        });
    } catch (err) {
        console.error("[AI] Error during thinking preparation:", err);
        STATE.busy = false;
    }
  }

  global.toggleAI = function() {
    console.log("[AI] Toggle Button Clicked. Current State:", STATE.autoEnabled);
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

  global.toggleAIAuto = global.toggleAI;
  global.runPuyoAI = think;

  function updateUI() {
    const btn = document.getElementById('ai-auto-button');
    if (btn) {
        btn.textContent = STATE.autoEnabled ? 'AI自動: ON' : 'AI自動: OFF';
        btn.style.backgroundColor = STATE.autoEnabled ? '#27ae60' : '#8e44ad';
    }
  }

  console.log("[AI] puyoAI_updated.js loaded and initialized");

})(window);
