/* puyoAI_updated.js
 * Updated to support WASM worker for pp-sim2 with extensive logging
 */
(function (global) {
  'use strict';

  const AI_CONFIG = {
    WORKER_PATH: './puyo-ai-worker-wasm.js',
    AUTO_TICK_MS: 500,
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
    if (data.action === 'THINK_DONE') {
      STATE.busy = false;
      updateStatus("AI 思考完了: x=" + data.x + ", rot=" + data.rotation);
      executeMove(data.x, data.rotation);
    } else if (data.action === 'LOG') {
      console.log("[AI Worker Log]:", data.message);
    }
  }

  function executeMove(targetX, targetRotation) {
    const _currentPuyo = window.currentPuyo;
    const _gameState = window.gameState;

    if (_gameState !== 'playing' || !_currentPuyo) {
        console.warn("[AI] Cannot execute move. State:", _gameState, "Puyo:", !!_currentPuyo);
        return;
    }

    try {
        console.log("[AI] Executing Move: x=" + targetX + ", rot=" + targetRotation);
        _currentPuyo.rotation = targetRotation;
        _currentPuyo.mainX = targetX;

        if (typeof window.hardDrop === 'function') {
            window.hardDrop();
        } else {
            console.warn("[AI] hardDrop not found on window");
        }
    } catch (err) {
        console.error("[AI] Error during move execution:", err);
    }
  }

  function updateStatus(text) {
    const el = document.getElementById('ai-status');
    if (el) el.textContent = text;
  }

  function think() {
    if (!STATE.workerReady || STATE.busy) return;

    // Access variables from window object
    const _board = window.board;
    const _nextQueue = window.nextQueue;
    const _queueIndex = window.queueIndex;
    const _currentPuyo = window.currentPuyo;
    const _gameState = window.gameState;

    if (!_board || !_currentPuyo) {
        console.log("[AI] Waiting for board/puyo to be available...");
        return;
    }

    if (_gameState !== 'playing') {
        // console.log("[AI] Game not in playing state:", _gameState);
        return;
    }

    console.log("[AI] Starting thinking process...");

    try {
        const flatBoard = new Int32Array(6 * 14);
        for (let y = 0; y < 14; y++) {
          for (let x = 0; x < 6; x++) {
            flatBoard[y * 6 + x] = _board[y][x];
          }
        }

        const pieces = new Int32Array(6);
        pieces[0] = _currentPuyo.mainColor;
        pieces[1] = _currentPuyo.subColor;
        
        if (_nextQueue && _nextQueue[_queueIndex]) {
          pieces[2] = _nextQueue[_queueIndex][1]; // main
          pieces[3] = _nextQueue[_queueIndex][0]; // sub
        }

        STATE.busy = true;
        updateStatus("AI 思考中...");
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

  console.log("[AI] puyoAI_updated.js loaded");

})(window);
