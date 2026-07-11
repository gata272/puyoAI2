(function(global) {
  const AI_CONFIG = {
    AUTO_TICK_MS: 500,
    WORKER_PATH: './puyo-ai-worker-wasm.js'
  };

  const STATE = {
    worker: null,
    workerReady: false,
    autoEnabled: false,
    autoTimer: null,
    busy: false,
    currentTurn: 0
  };

  function updateStatus(msg) {
    console.log("[AI Status]", msg);
    const statusEl = document.getElementById('ai-status');
    if (statusEl) statusEl.innerText = msg;
  }

  function initWorker() {
    if (STATE.worker) return;
    STATE.worker = new Worker(AI_CONFIG.WORKER_PATH, { type: 'module' });
    STATE.worker.onmessage = function(e) {
      const { action, message, x, rotation } = e.data;
      if (action === 'LOG') {
        console.log("[AI Worker Log]:", message);
        if (message.includes("Initialized successfully")) {
          STATE.workerReady = true;
          updateStatus("AI 準備完了");
        }
      } else if (action === 'THINK_DONE') {
        console.log("[AI] Think Done. X:", x, "Rot:", rotation);
        executeMoveAggressively(x, rotation);
        STATE.busy = false;
        STATE.currentTurn++;
        updateStatus("AI 待機中");
      }
    };
  }

  function executeMoveAggressively(targetX, targetRot) {
    if (!global.currentPuyo) return;
    global.currentPuyo.mainX = targetX;
    global.currentPuyo.rotation = targetRot;
    if (typeof global.mainX !== 'undefined') global.mainX = targetX;
    if (typeof global.rotation !== 'undefined') global.rotation = targetRot;
    if (typeof global.hardDrop === 'function') global.hardDrop();
  }

  function isBoardEmpty() {
    if (!global.board) return true;
    for (let y = 0; y < global.board.length; y++) {
      for (let x = 0; x < global.board[y].length; x++) {
        if (global.board[y][x] !== 0) return false;
      }
    }
    return true;
  }

  function think() {
    if (!STATE.workerReady || STATE.busy || !STATE.autoEnabled) return;

    const _nextQueue = global.nextQueue;
    const _queueIndex = global.queueIndex;
    const _currentPuyo = global.currentPuyo;
    const _gameState = global.gameState;

    if (!_currentPuyo || _gameState !== 'playing') return;

    // 盤面が空でない、かつGTRの途中（1-3手目）でもない場合は何もしない
    if (STATE.currentTurn === 0 && !isBoardEmpty()) {
        return;
    }
    
    // 3手終わったら停止
    if (STATE.currentTurn >= 3) {
        return;
    }

    try {
        const pieces = new Int32Array(6);
        pieces[0] = _currentPuyo.mainColor;
        pieces[1] = _currentPuyo.subColor;
        
        if (_nextQueue && _nextQueue[_queueIndex]) {
          pieces[2] = _nextQueue[_queueIndex][1]; // main
          pieces[3] = _nextQueue[_queueIndex][0]; // sub
        }
        if (_nextQueue && _nextQueue[_queueIndex + 1]) {
          pieces[4] = _nextQueue[_queueIndex + 1][1]; // main
          pieces[5] = _nextQueue[_queueIndex + 1][0]; // sub
        }

        STATE.busy = true;
        updateStatus("AI 思考中...");
        STATE.worker.postMessage({
          action: 'THINK',
          pieceBuffer: pieces
        });
    } catch (err) {
        console.error("[AI] Error in think loop:", err);
        STATE.busy = false;
    }
  }

  global.toggleAI = function() {
    STATE.autoEnabled = !STATE.autoEnabled;
    if (STATE.autoEnabled) {
      initWorker();
      resetAIState();
      STATE.autoTimer = setInterval(think, AI_CONFIG.AUTO_TICK_MS);
      updateStatus("AI 自動モード: ON");
    } else {
      clearInterval(STATE.autoTimer);
      updateStatus("AI 自動モード: OFF");
    }
    updateUI();
  };

  function resetAIState() {
    STATE.currentTurn = 0;
    if (STATE.worker) STATE.worker.postMessage({ action: 'RESET_TURN' });
    console.log("[AI] AI State Reset");
  }

  // シミュレーターのリセットを検知
  const originalInitGame = global.initGame;
  global.initGame = function() {
    if (originalInitGame) originalInitGame.apply(this, arguments);
    resetAIState();
  };

  function updateUI() {
    const btn = document.getElementById('ai-toggle-btn');
    if (btn) {
      btn.innerText = STATE.autoEnabled ? "AI自動: ON" : "AI自動: OFF";
      btn.style.backgroundColor = STATE.autoEnabled ? "#4CAF50" : "#f44336";
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.createElement('button');
    btn.id = 'ai-toggle-btn';
    btn.innerText = "AI自動: OFF";
    btn.style.position = 'fixed';
    btn.style.bottom = '20px';
    btn.style.right = '20px';
    btn.style.padding = '10px 20px';
    btn.style.zIndex = '1000';
    btn.style.backgroundColor = '#f44336';
    btn.style.color = 'white';
    btn.style.border = 'none';
    btn.style.borderRadius = '5px';
    btn.style.cursor = 'pointer';
    btn.onclick = global.toggleAI;
    document.body.appendChild(btn);

    const status = document.createElement('div');
    status.id = 'ai-status';
    status.style.position = 'fixed';
    status.style.bottom = '60px';
    status.style.right = '20px';
    status.style.zIndex = '1000';
    status.style.color = 'white';
    status.style.fontSize = '12px';
    status.innerText = "AI 待機中";
    document.body.appendChild(status);
  });

})(window);
