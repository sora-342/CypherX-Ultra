
let currentSessionPhone = null;
let currentSessionToken = null;
let currentGameCode = null;
let currentGameType = null; 
let gamePollingInterval = null;
let gamePlayerSymbol = null;
let gameCreatorPhone = null;
let gameOpponentPhone = null;
let pairingPollInterval = null;
let pairingPollTimeout = null;
let pairingStatusInterval = null;
let pairingStatusTimeout = null;

const elements = {
  authNav: document.getElementById('authNav'),
  loginForm: document.getElementById('loginForm'),
  registerForm: document.getElementById('registerForm'),
  loginAlert: document.getElementById('loginAlert'),
  registerAlert: document.getElementById('registerAlert'),
  pairCodeBox: document.getElementById('pairCodeBox'),
  loginPhone: document.getElementById('loginPhone'),
  accessCode: document.getElementById('accessCode'),
  accessCodeGroup: document.getElementById('accessCodeGroup'),
  verifyCodeBtn: document.getElementById('verifyCodeBtn'),
  sessionId: document.getElementById('sessionId'),
  pairPhone: document.getElementById('pairPhone'),
  masterPassword: document.getElementById('masterPassword'),

  settingsDashboard: document.getElementById('settingsDashboard'),
  sessionOwnerName: document.getElementById('sessionOwnerName'),
  sessionInfo: document.getElementById('sessionInfo'),
  settingsContainer: document.getElementById('settingsContainer'),
  settingsTab: document.getElementById('settingsTab'),
  gamesTab: document.getElementById('gamesTab'),

  pendingGamesContainer: document.getElementById('pendingGamesContainer'),
  pendingGameCode: document.getElementById('pendingGameCode'),
  joinGameForm: document.getElementById('joinGameForm'),
  gameCodeInput: document.getElementById('gameCodeInput'),
  gameBoard: document.getElementById('gameBoard'),
  gameInfo: document.getElementById('gameInfo'),
  board: document.getElementById('board')
};

function showAlert(alertDiv, message, type) {
  alertDiv.className = `alert alert-${type}`;
  alertDiv.textContent = message;
  alertDiv.classList.remove('hidden');
  alertDiv.style.animation = 'slideIn 0.3s ease-out';

  if (type === 'success') {
    setTimeout(() => {
      alertDiv.style.animation = 'slideOut 0.3s ease-out';
      setTimeout(() => alertDiv.classList.add('hidden'), 300);
    }, 3000);
  }
}

function showLoading(container, message = 'Loading...') {
  container.innerHTML = `
    <div class="loading">
      <div class="spinner"></div>
      <p>${message}</p>
    </div>
  `;
}

function formatValue(value) {
  if (typeof value === 'boolean') return value ? '✅ Enabled' : '❌ Disabled';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function initAuthNavigation() {
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');

      const mode = e.target.dataset.mode;
      elements.loginForm.classList.toggle('hidden', mode === 'register');
      elements.registerForm.classList.toggle('hidden', mode === 'login');
    });
  });
}

async function requestAccessCode() {
  const phone = elements.loginPhone.value.trim();

  if (!phone) {
    showAlert(elements.loginAlert, 'Please enter a phone number', 'error');
    return;
  }

  showAlert(elements.loginAlert, 'Requesting access code...', 'info');

  try {
    const response = await fetch('/api/request-access-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });

    const data = await response.json();

    if (response.ok) {
      showAlert(elements.loginAlert, 'Access code sent! Check your message myself', 'success');
      elements.accessCodeGroup.classList.remove('hidden');
      elements.verifyCodeBtn.classList.remove('hidden');
      currentSessionPhone = phone;
    } else {
      showAlert(elements.loginAlert, data.error || 'Failed to request access code', 'error');
    }
  } catch (error) {
    showAlert(elements.loginAlert, 'Error: ' + error.message, 'error');
  }
}

async function verifyAccessCode() {
  const code = elements.accessCode.value.trim();

  if (!code) {
    showAlert(elements.loginAlert, 'Please enter the access code', 'error');
    return;
  }

  showAlert(elements.loginAlert, 'Verifying code...', 'info');

  try {
    const response = await fetch('/api/verify-access-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: currentSessionPhone, code })
    });

    const data = await response.json();

    if (response.ok) {
      currentSessionToken = data.token;
      localStorage.setItem('sessionToken', data.token);
      localStorage.setItem('sessionPhone', currentSessionPhone);
      loginSuccess();
    } else {
      showAlert(elements.loginAlert, data.error || 'Invalid access code', 'error');
    }
  } catch (error) {
    showAlert(elements.loginAlert, 'Error: ' + error.message, 'error');
  }
}

async function registerSession() {
  const sessionId = elements.sessionId.value.trim();
  const phone = elements.pairPhone.value.trim();
  const password = elements.masterPassword.value;

  if (!sessionId && !phone) {
    showAlert(elements.registerAlert, 'Please enter a session ID or phone number', 'error');
    return;
  }

  if (sessionId && phone) {
    showAlert(elements.registerAlert, 'Use either session ID or phone number, not both', 'error');
    return;
  }

  if (!password) {
    showAlert(elements.registerAlert, 'Please enter the master password', 'error');
    return;
  }

  showAlert(elements.registerAlert, sessionId ? 'Verifying password and pairing session...' : 'Verifying password and generating pairing code...', 'info');
  elements.pairCodeBox.classList.add('hidden');
  elements.pairCodeBox.textContent = '';

  try {
    const registerRes = await fetch('/api/register-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, sessionId: sessionId || undefined, phone: phone || undefined })
    });

    const data = await registerRes.json();

    if (!registerRes.ok) {
      showAlert(elements.registerAlert, data.error || 'Registration failed', 'error');
      return;
    }

    showAlert(elements.registerAlert, data.message || 'Session registered successfully!', 'success');

    if (data.pairingCode) {
      elements.pairCodeBox.className = 'alert alert-info';
      elements.pairCodeBox.textContent = `Pairing Code: ${data.pairingCode}`;
      elements.pairCodeBox.classList.remove('hidden');
      startPairingCodePolling(phone, password);
      startPairingStatusPolling(phone, password);
    }

    elements.sessionId.value = '';
    elements.pairPhone.value = '';
    elements.masterPassword.value = '';
  } catch (error) {
    showAlert(elements.registerAlert, 'Error: ' + error.message, 'error');
  }
}

function startPairingCodePolling(phone, password) {
  if (!phone || !password) return;

  if (pairingPollInterval) clearInterval(pairingPollInterval);
  if (pairingPollTimeout) clearTimeout(pairingPollTimeout);

  const poll = async () => {
    try {
      const response = await fetch('/api/pairing-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });

      if (response.status === 404) {
        stopPairingCodePolling();
        return;
      }

      const data = await response.json();
      if (response.ok && data.code) {
        const currentText = elements.pairCodeBox.textContent || '';
        const nextText = `Pairing Code: ${data.code}`;
        if (currentText !== nextText) {
          elements.pairCodeBox.className = 'alert alert-info';
          elements.pairCodeBox.textContent = nextText;
          elements.pairCodeBox.classList.remove('hidden');
        }
      }
    } catch {}
  };

  pairingPollInterval = setInterval(poll, 5000);
  pairingPollTimeout = setTimeout(() => stopPairingCodePolling(), 2 * 60 * 1000);
  poll();
}

function stopPairingCodePolling() {
  if (pairingPollInterval) clearInterval(pairingPollInterval);
  if (pairingPollTimeout) clearTimeout(pairingPollTimeout);
  pairingPollInterval = null;
  pairingPollTimeout = null;
}

function startPairingStatusPolling(phone, password) {
  if (!phone || !password) return;

  if (pairingStatusInterval) clearInterval(pairingStatusInterval);
  if (pairingStatusTimeout) clearTimeout(pairingStatusTimeout);

  const poll = async () => {
    try {
      const response = await fetch('/api/pairing-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });

      const data = await response.json();
      if (response.ok && data.paired) {
        showAlert(elements.registerAlert, '✅ Pairing successful! You can now login.', 'success');
        stopPairingStatusPolling();
        stopPairingCodePolling();
        elements.pairCodeBox.classList.add('hidden');
        elements.pairCodeBox.textContent = '';
      }
    } catch {}
  };

  pairingStatusInterval = setInterval(poll, 3000);
  pairingStatusTimeout = setTimeout(() => stopPairingStatusPolling(), 2 * 60 * 1000);
  poll();
}

function stopPairingStatusPolling() {
  if (pairingStatusInterval) clearInterval(pairingStatusInterval);
  if (pairingStatusTimeout) clearTimeout(pairingStatusTimeout);
  pairingStatusInterval = null;
  pairingStatusTimeout = null;
}

function loginSuccess() {
  document.getElementById('authCard').classList.add('hidden');
  elements.settingsDashboard.classList.remove('hidden');

  loadSettings();
}

async function loadSettings() {
  showLoading(elements.settingsContainer, 'Loading settings...');

  try {
    const response = await fetch('/api/settings', {
      headers: { 'Authorization': `Bearer ${currentSessionToken}` }
    });

    const data = await response.json();

    if (response.ok) {
      displaySettings(data);
    } else {
      logout();
    }
  } catch (error) {
    console.error('Error loading settings:', error);
    showAlert(elements.loginAlert, 'Failed to load settings', 'error');
  }
}

function displaySettings(settings) {
  elements.sessionInfo.textContent = `Phone: ${currentSessionPhone}`;

  let html = '';

  for (const [key, value] of Object.entries(settings)) {
    const inputType = typeof value === 'boolean' ? 'checkbox' : 'text';
    const inputValue = typeof value === 'boolean' ? '' : value;
    const checked = typeof value === 'boolean' ? (value ? 'checked' : '') : '';

    html += `
      <div class="setting-item">
        <div class="setting-label">${key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</div>
        <div class="setting-value">${formatValue(value)}</div>
        <div class="setting-input-group">
          ${inputType === 'checkbox'
            ? `<label class="toggle-switch">
                <input type="checkbox" data-setting="${key}" ${checked} onchange="updateSetting('${key}', this)">
                <span class="toggle-slider"></span>
               </label>`
            : `<input type="${inputType}" data-setting="${key}" value="${inputValue}" class="setting-input" placeholder="Enter new value">
               <button onclick="updateSetting('${key}', this)" class="btn-update">Update</button>`
          }
        </div>
      </div>
    `;
  }

  elements.settingsContainer.innerHTML = html;
}

async function updateSetting(key, element) {
  let value;

  if (element.type === 'checkbox') {
    value = element.checked;
  } else {
    const input = element.previousElementSibling;
    value = input.value;

    if (input.type === 'number') {
      value = parseFloat(value) || value;
    }
  }

  try {
    const response = await fetch('/api/update-setting', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSessionToken}`
      },
      body: JSON.stringify({ key, value })
    });

    if (response.ok) {
      const settingItem = element.closest('.setting-item');
      const valueDisplay = settingItem.querySelector('.setting-value');
      valueDisplay.textContent = formatValue(value);

      element.style.background = '#28a745';
      element.textContent = '✓ Updated';
      setTimeout(() => {
        element.style.background = '';
        element.textContent = 'Update';
      }, 2000);
    } else {
      showAlert(elements.loginAlert, 'Failed to update setting', 'error');
    }
  } catch (error) {
    showAlert(elements.loginAlert, 'Error: ' + error.message, 'error');
  }
}

function switchTab(tabName) {
  elements.settingsTab.classList.add('hidden');
  elements.gamesTab.classList.add('hidden');
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.classList.remove('active');
  });

  if (tabName === 'settings') {
    elements.settingsTab.classList.remove('hidden');
    document.querySelector('.nav-tab[onclick*="settings"]').classList.add('active');
  } else if (tabName === 'games') {
    elements.gamesTab.classList.remove('hidden');
    document.querySelector('.nav-tab[onclick*="games"]').classList.add('active');
  }
}

async function createTictactoeGame() {
  try {
    currentGameType = 'tictactoe';
    const response = await fetch('/api/games/create-tictactoe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSessionToken}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      currentGameCode = data.gameCode;
      gameCreatorPhone = currentSessionPhone;
      gamePlayerSymbol = 'X'; 
      gameOpponentPhone = null;
      showPendingGame(data.gameCode);
    } else {
      showNotification('Error: ' + data.error, 'error');
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

async function createRpsGame() {
  try {
    currentGameType = 'rps';
    const response = await fetch('/api/games/create-rps', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSessionToken}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      currentGameCode = data.gameCode;
      gameCreatorPhone = currentSessionPhone;
      gamePlayerSymbol = null; 
      gameOpponentPhone = null;

      showPendingGame(data.gameCode);
    } else {
      showNotification('Error: ' + data.error, 'error');
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

async function createCoinGame() {
  try {
    currentGameType = 'coin';
    const response = await fetch('/api/games/create-coin', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSessionToken}`
      }
    });

    const data = await response.json();

    if (response.ok) {
      currentGameCode = data.gameCode;
      gameCreatorPhone = currentSessionPhone;
      gamePlayerSymbol = null;
      gameOpponentPhone = null;

      showPendingGame(data.gameCode);
    } else {
      showNotification('Error: ' + data.error, 'error');
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

function showPendingGame(gameCode) {
  elements.pendingGameCode.textContent = gameCode;
 
  const header = document.getElementById('pendingHeader');
  if (header) {
    let icon = '🎮';
    let name = 'Game';
    if (currentGameType === 'tictactoe') {
      icon = '⭕';
      name = 'Tic Tac Toe';
    } else if (currentGameType === 'rps') {
      icon = '🪨📄✂️';
      name = 'Rock Paper Scissors';
    } else if (currentGameType === 'coin') {
      icon = '🪙';
      name = 'Coin Flip';
    }
    header.textContent = `${icon} Your Pending ${name}`;
  }

  elements.pendingGamesContainer.classList.remove('hidden');
  elements.joinGameForm.classList.add('hidden');
  elements.gameBoard.classList.add('hidden');

  if (gamePollingInterval) clearInterval(gamePollingInterval);
  gamePollingInterval = setInterval(checkForOpponent, 1000);
}

function showJoinGameForm() {
  elements.pendingGamesContainer.classList.add('hidden');
  elements.gameBoard.classList.add('hidden');
  elements.joinGameForm.classList.remove('hidden');
  elements.gameCodeInput.focus();
}

async function checkForOpponent() {
  try {
    const response = await fetch(`/api/games/${currentGameCode}`, {
      headers: { 'Authorization': `Bearer ${currentSessionToken}` }
    });

    const game = await response.json();

    if (game.status === 'active' || game.opponentPhone) {
      clearInterval(gamePollingInterval);
      gamePollingInterval = null;
      gameOpponentPhone = game.opponentPhone;
      showGameBoard();
    }
  } catch (error) {
    console.error('Error checking for opponent:', error);
  }
}

function copyGameCode() {
  const gameCode = elements.pendingGameCode.textContent;
  navigator.clipboard.writeText(gameCode).then(() => {
    showNotification('Game code copied to clipboard!', 'success');
  }).catch(() => {
    const textArea = document.createElement('textarea');
    textArea.value = gameCode;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    showNotification('Game code copied to clipboard!', 'success');
  });
}

async function cancelPendingGame() {
  try {
    const response = await fetch(`/api/games/${currentGameCode}/cancel`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${currentSessionToken}` }
    });

    if (response.ok) {
      backToGames();
      showNotification('Game cancelled', 'info');
    } else {
      showNotification('Error cancelling game', 'error');
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

async function joinGameWithCode() {
  const gameCode = elements.gameCodeInput.value.trim().toUpperCase();

  if (!gameCode) {
    showNotification('Please enter a game code', 'error');
    return;
  }

  try {
    const response = await fetch('/api/games/join', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSessionToken}`
      },
      body: JSON.stringify({ gameCode })
    });

    const data = await response.json();

    if (response.ok) {
      currentGameCode = gameCode;
      currentGameType = data.game.type;
      gameCreatorPhone = data.game.creatorPhone;
      gameOpponentPhone = currentSessionPhone; 
      gamePlayerSymbol = currentGameType === 'tictactoe' ? 'O' : null;
      elements.joinGameForm.classList.add('hidden');
      elements.gameCodeInput.value = '';
      showNotification(`🎮 Joined Game!\n\nYou are: ${currentGameType === 'tictactoe' ? '⭕ O' : ''}\n\nGame starting...`, 'success');
      showGameBoard();
    } else {
      showNotification('Error: ' + data.error, 'error');
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

async function showGameBoard() {
  elements.pendingGamesContainer.classList.add('hidden');
  elements.joinGameForm.classList.add('hidden');
  elements.gameBoard.classList.remove('hidden');

  await updateGameBoard();

  if (gamePollingInterval) clearInterval(gamePollingInterval);
  gamePollingInterval = setInterval(updateGameBoard, 1000);
}

async function updateGameBoard() {
  try {
    const response = await fetch(`/api/games/${currentGameCode}`, {
      headers: { 'Authorization': `Bearer ${currentSessionToken}` }
    });

    const game = await response.json();

    if (!gameCreatorPhone) gameCreatorPhone = game.creatorPhone;
    if (!gameOpponentPhone && game.opponentPhone) gameOpponentPhone = game.opponentPhone;
    if (!gamePlayerSymbol && game.type === 'tictactoe') {
      gamePlayerSymbol = currentSessionPhone === game.creatorPhone ? 'X' : 'O';
    }

    let playerInfo = '';

    if (game.type === 'tictactoe') {
      const isYourTurn = (gamePlayerSymbol === 'X' && game.currentTurn === 'X') ||
                         (gamePlayerSymbol === 'O' && game.currentTurn === 'O');

      if (game.status === 'waiting') {
        playerInfo = `
          <div class="game-status waiting">
            <div class="status-icon">⏳</div>
            <div class="status-text">
              <h3>Waiting for Opponent</h3>
              <p>Share game code: <strong>${currentGameCode}</strong></p>
            </div>
            <div class="player-info">
              <div class="player player-x">
                <span class="symbol">❌</span>
                <span class="name">${gameCreatorPhone === currentSessionPhone ? 'You' : gameCreatorPhone}</span>
              </div>
            </div>
          </div>
        `;
      } else if (game.status === 'active') {
        const creatorDisplay = gameCreatorPhone === currentSessionPhone ? 'You' : gameCreatorPhone;
        const opponentDisplay = gameOpponentPhone === currentSessionPhone ? 'You' : gameOpponentPhone;

        playerInfo = `
          <div class="game-status active">
            <div class="players">
              <div class="player player-x ${game.currentTurn === 'X' ? 'active' : ''}">
                <span class="symbol">❌</span>
                <span class="name">${creatorDisplay}</span>
                ${game.currentTurn === 'X' ? '<span class="turn-indicator">🎯</span>' : ''}
              </div>
              <div class="vs">VS</div>
              <div class="player player-o ${game.currentTurn === 'O' ? 'active' : ''}">
                <span class="symbol">⭕</span>
                <span class="name">${opponentDisplay}</span>
                ${game.currentTurn === 'O' ? '<span class="turn-indicator">🎯</span>' : ''}
              </div>
            </div>
            <div class="turn-message ${isYourTurn ? 'your-turn' : 'opponent-turn'}">
              ${isYourTurn ? '🎯 Your Turn!' : '⏳ Opponent\'s Turn'}
            </div>
          </div>
        `;
      } else if (game.status === 'finished') {
        const creatorDisplay = gameCreatorPhone === currentSessionPhone ? 'You' : gameCreatorPhone;
        const opponentDisplay = gameOpponentPhone === currentSessionPhone ? 'You' : gameOpponentPhone;

        let resultMsg = '';
        let resultClass = '';

        if (game.winner === 'draw') {
          resultMsg = '🤝 It\'s a Draw!';
          resultClass = 'draw';
        } else {
          const winnerDisplay = game.winner === 'X' ? creatorDisplay : opponentDisplay;
          const isYouWinner = (game.winner === 'X' && gameCreatorPhone === currentSessionPhone) ||
                             (game.winner === 'O' && gameOpponentPhone === currentSessionPhone);
          resultMsg = isYouWinner ? '🎉 You Win!' : `🎉 ${winnerDisplay} Wins!`;
          resultClass = isYouWinner ? 'win' : 'lose';
        }

        playerInfo = `
          <div class="game-status finished ${resultClass}">
            <div class="result-message">
              <h2>${resultMsg}</h2>
              <p>Game Code: ${currentGameCode}</p>
            </div>
            <div class="final-players">
              <div class="player player-x ${game.winner === 'X' ? 'winner' : ''}">
                <span class="symbol">❌</span>
                <span class="name">${creatorDisplay}</span>
              </div>
              <div class="vs">VS</div>
              <div class="player player-o ${game.winner === 'O' ? 'winner' : ''}">
                <span class="symbol">⭕</span>
                <span class="name">${opponentDisplay}</span>
              </div>
            </div>
          </div>
        `;
      }

      elements.gameInfo.innerHTML = playerInfo;

      const boardDiv = elements.board;
      boardDiv.style.display = 'grid';
      boardDiv.innerHTML = '';

      for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        cell.className = 'game-cell';
        cell.textContent = game.board[i] || '';

        if (game.board[i]) {
          cell.classList.add(game.board[i] === 'X' ? 'x' : 'o');
        }

        if (!game.board[i] && game.status === 'active' && isYourTurn) {
          cell.onclick = () => makeGameMove(i);
          cell.classList.add('clickable');
        }

        boardDiv.appendChild(cell);
      }
    } else if (game.type === 'rps') {
      if (game.status === 'waiting') {
        playerInfo = `
          <div class="game-status waiting">
            <div class="status-icon">⏳</div>
            <div class="status-text">
              <h3>Waiting for Opponent</h3>
              <p>Share game code: <strong>${currentGameCode}</strong></p>
            </div>
            <div class="player-info">
              <div class="player">
                <span class="symbol">🪨📄✂️</span>
                <span class="name">${gameCreatorPhone === currentSessionPhone ? 'You' : gameCreatorPhone}</span>
              </div>
            </div>
          </div>
        `;
      } else if (game.status === 'active') {
        const youAreCreator = currentSessionPhone === game.creatorPhone;
        const yourChoice = youAreCreator ? game.creatorChoice : game.opponentChoice;
        const oppChoice = youAreCreator ? game.opponentChoice : game.creatorChoice;

        let choiceSection = '';
        if (!yourChoice) {
          choiceSection = `
            <div style="text-align:center; margin-top:20px;">
              <button class="btn btn-primary" onclick="makeGameMove('rock')">🪨 Rock</button>
              <button class="btn btn-primary" onclick="makeGameMove('paper')">📄 Paper</button>
              <button class="btn btn-primary" onclick="makeGameMove('scissors')">✂️ Scissors</button>
            </div>
          `;
        } else {
          choiceSection = `<p>You chose: <strong>${yourChoice}</strong></p>`;
        }

        playerInfo = `
          <div class="game-status active">
            <div class="players">
              <div class="player">
                <span class="symbol">🪨📄✂️</span>
                <span class="name">${youAreCreator ? 'You' : 'Opponent'}</span>
              </div>
              <div class="vs">VS</div>
              <div class="player">
                <span class="symbol">🪨📄✂️</span>
                <span class="name">${youAreCreator ? 'Opponent' : 'You'}</span>
              </div>
            </div>
            ${choiceSection}
          </div>
        `;
      } else if (game.status === 'finished') {
        let resultMsg = '';
        if (game.winner === 'draw') {
          resultMsg = '🤝 It\'s a Draw!';
        } else if ((game.winner === 'creator' && currentSessionPhone === game.creatorPhone) ||
                   (game.winner === 'opponent' && currentSessionPhone === game.opponentPhone)) {
          resultMsg = '🎉 You Win!';
        } else {
          resultMsg = '😞 You Lose!';
        }

        playerInfo = `
          <div class="game-status finished">
            <div class="result-message">
              <h2>${resultMsg}</h2>
              <p>Game Code: ${currentGameCode}</p>
            </div>
            <div class="final-choices">
              <p>Creator chose: <strong>${game.creatorChoice || 'N/A'}</strong></p>
              <p>Opponent chose: <strong>${game.opponentChoice || 'N/A'}</strong></p>
            </div>
          </div>
        `;
      }

      elements.gameInfo.innerHTML = playerInfo;
      elements.board.style.display = 'none';
    } else if (game.type === 'coin') {
      if (game.status === 'waiting') {
        playerInfo = `
          <div class="game-status waiting">
            <div class="status-icon">⏳</div>
            <div class="status-text">
              <h3>Waiting for Opponent</h3>
              <p>Share game code: <strong>${currentGameCode}</strong></p>
            </div>
            <div class="player-info">
              <div class="player">
                <span class="symbol">🪙</span>
                <span class="name">${gameCreatorPhone === currentSessionPhone ? 'You' : gameCreatorPhone}</span>
              </div>
            </div>
          </div>
        `;
      } else if (game.status === 'active') {
        const youAreCreator = currentSessionPhone === game.creatorPhone;
        let choiceSection = '';
        if (!game.guess && !youAreCreator) {
          choiceSection = `
            <div style="text-align:center; margin-top:20px;">
              <button class="btn btn-primary" onclick="makeGameMove('heads')">🟡 Heads</button>
              <button class="btn btn-primary" onclick="makeGameMove('tails')">⚫ Tails</button>
            </div>
          `;
        } else if (!youAreCreator) {
          choiceSection = `<p>Your guess: <strong>${game.guess}</strong></p>`;
        }

        playerInfo = `
          <div class="game-status active">
            <div class="players">
              <div class="player">
                <span class="symbol">🪙</span>
                <span class="name">${youAreCreator ? 'You' : 'Opponent'}</span>
              </div>
              <div class="vs">VS</div>
              <div class="player">
                <span class="symbol">🪙</span>
                <span class="name">${youAreCreator ? 'Opponent' : 'You'}</span>
              </div>
            </div>
            ${choiceSection}
          </div>
        `;
      } else if (game.status === 'finished') {
        let resultMsg = '';
        if (game.winner === 'opponent' && currentSessionPhone === game.opponentPhone) {
          resultMsg = '🎉 You Guessed Correctly!';
        } else if (game.winner === 'creator' && currentSessionPhone === game.creatorPhone) {
          resultMsg = '🎉 Your Opponent Guessed Wrong!';
        } else {
          resultMsg = '😞 You Lost';
        }

        playerInfo = `
          <div class="game-status finished">
            <div class="result-message">
              <h2>${resultMsg}</h2>
              <p>Game Code: ${currentGameCode}</p>
            </div>
            <div class="final-choices">
              <p>Guess: <strong>${game.guess || 'N/A'}</strong></p>
              <p>Flip result: <strong>${game.coinResult || 'N/A'}</strong></p>
            </div>
          </div>
        `;
      }

      elements.gameInfo.innerHTML = playerInfo;
      elements.board.style.display = 'none';
    }
  } catch (error) {
    console.error('Error updating game:', error);
  }
}

async function makeGameMove(move) {
  try {
    const body = {};
    if (currentGameType === 'tictactoe') {
      body.position = move;
    } else if (currentGameType === 'rps') {
      body.choice = move;
    }

    const response = await fetch(`/api/games/${currentGameCode}/move`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${currentSessionToken}`
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (response.ok) {
      updateGameBoard();
    } else {
      showNotification('Error: ' + data.error, 'error');
    }
  } catch (error) {
    showNotification('Error: ' + error.message, 'error');
  }
}

function backToGames() {
  currentGameCode = null;
  gamePlayerSymbol = null;
  gameCreatorPhone = null;
  gameOpponentPhone = null;
  if (gamePollingInterval) {
    clearInterval(gamePollingInterval);
    gamePollingInterval = null;
  }

  elements.gameBoard.classList.add('hidden');
  elements.pendingGamesContainer.classList.add('hidden');
  elements.joinGameForm.classList.add('hidden');
}

function logout() {
  localStorage.removeItem('sessionToken');
  localStorage.removeItem('sessionPhone');
  currentSessionToken = null;
  currentSessionPhone = null;

  elements.settingsDashboard.classList.add('hidden');
  document.getElementById('authCard').classList.remove('hidden');
  elements.loginForm.classList.remove('hidden');
  elements.registerForm.classList.add('hidden');
  elements.authNav.classList.remove('hidden');
  elements.accessCodeGroup.classList.add('hidden');
  elements.verifyCodeBtn.classList.add('hidden');

  elements.masterPassword.value = '';
  elements.loginPhone.value = '';
  elements.accessCode.value = '';
  elements.sessionId.value = '';
  elements.pairPhone.value = '';
  elements.pairCodeBox.classList.add('hidden');
  elements.pairCodeBox.textContent = '';
  stopPairingCodePolling();
  stopPairingStatusPolling();
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-icon">${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
      <span class="notification-message">${message}</span>
    </div>
    <button class="notification-close" onclick="this.parentElement.remove()">×</button>
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    if (notification.parentElement) {
      notification.style.animation = 'slideOutRight 0.3s ease-out';
      setTimeout(() => notification.remove(), 300);
    }
  }, 5000);
}

function initApp() {
  initAuthNavigation();

  const token = localStorage.getItem('sessionToken');
  const phone = localStorage.getItem('sessionPhone');

  if (token && phone) {
    currentSessionToken = token;
    currentSessionPhone = phone;
    loginSuccess();
  }

  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateY(-10px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateY(0); opacity: 1; }
      to { transform: translateY(-10px); opacity: 0; }
    }
    @keyframes slideOutRight {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

document.addEventListener('DOMContentLoaded', initApp);
