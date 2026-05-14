// ============================================================
// multiplayer.js — LOGIKA REALTIME MULTIPLAYER (Client)
// Menggunakan Socket.IO untuk komunikasi realtime
// ============================================================

// ── State ─────────────────────────────────────────────────────
const MP = {
  socket:        null,
  roomCode:      null,
  myName:        null,
  isHost:        false,
  players:       [],
  options:       [],
  isSpinning:    false,
  angle:         0,
  animationId:   null,
  connected:     false,
  reconnectTimer: null,
};

const MP_COLORS = [
  '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF',
  '#FF9A3C', '#C77DFF', '#00C9A7', '#F72585'
];

const MP_PRESETS = {
  makan:   ['Nasi Goreng', 'Mie Ayam', 'Bakso', 'Pecel Lele', 'Soto', 'Warteg'],
  weekend: ['Main game', 'Nonton film', 'Tidur', 'Jalan-jalan', 'Baca buku', 'Olahraga'],
};

// ── Init ──────────────────────────────────────────────────────
function initMultiplayer(defaultName) {
  MP.myName = defaultName;
  loadSocketIO(connectSocket);

  window.addEventListener('beforeunload', () => {
    if (MP.socket) MP.socket.disconnect();
    if (window.AudioController) AudioController.stopBacksound();
  });
}

// Muat Socket.IO secara dinamis dari server
function loadSocketIO(callback) {
  if (window.io) { callback(); return; }

  updateServerStatus('connecting', 'Memuat socket library…');

  const script = document.createElement('script');
  script.src = window.SOCKET_SERVER_URL + '/socket.io/socket.io.js';
  script.onload = callback;
  script.onerror = () => {
    updateServerStatus('disconnected', 'Server offline — fitur multiplayer tidak tersedia');
    showOfflineMessage();
  };
  document.head.appendChild(script);
}

// ── Socket Connection ─────────────────────────────────────────
function connectSocket() {
  updateServerStatus('connecting', 'Menghubungkan…');

  MP.socket = io(window.SOCKET_SERVER_URL, {
    transports: ['websocket', 'polling'],
    timeout: 5000,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  // ── Connection events ──────────────────────────────────────
  MP.socket.on('connect', () => {
    MP.connected = true;
    updateServerStatus('connected', 'Terhubung ke server');
    enableLobbyButtons(true);
    clearTimeout(MP.reconnectTimer);
  });

  MP.socket.on('disconnect', () => {
    MP.connected = false;
    updateServerStatus('disconnected', 'Koneksi terputus — mencoba ulang…');
    enableLobbyButtons(false);
  });

  MP.socket.on('connect_error', () => {
    updateServerStatus('disconnected', 'Tidak dapat terhubung ke server');
    enableLobbyButtons(false);
  });

  // ── Room events ────────────────────────────────────────────

  // Room berhasil dibuat / joined
  MP.socket.on('room:joined', ({ roomCode, players, options, isHost }) => {
    MP.roomCode = roomCode;
    MP.isHost   = isHost;
    MP.players  = players;
    MP.options  = options || [];

    showScreen('screenRoom');
    updateRoomHeader();
    renderPlayers();
    mpRenderOptions();
    drawMpWheel();
    resizeMpCanvas();

    addFeedItem('🎉', `Kamu bergabung ke room <strong>${roomCode}</strong>`);
    showToast(`Bergabung ke room ${roomCode}! 🎉`, 'success');
  });

  // Ada player baru
  MP.socket.on('room:playerJoined', ({ player, players }) => {
    MP.players = players;
    renderPlayers();
    addFeedItem('👋', `<strong>${player.name}</strong> bergabung ke room`);
    showToast(`${player.name} bergabung! 👋`, 'success');
  });

  // Player keluar
  MP.socket.on('room:playerLeft', ({ playerName, players, newHost }) => {
    MP.players = players;
    if (newHost && newHost === MP.socket.id) {
      MP.isHost = true;
      updateRoomHeader();
      mpUpdateHostUI();
      addFeedItem('👑', 'Kamu sekarang jadi Host!');
      showToast('Kamu jadi Host baru! 👑', 'success');
    }
    renderPlayers();
    addFeedItem('👋', `<strong>${playerName}</strong> keluar dari room`);
  });

  // Sync options dari host
  MP.socket.on('room:optionsUpdated', ({ options }) => {
    MP.options = options;
    if (!MP.isHost) {
      mpRenderOptions();
      drawMpWheel();
    }
  });

  // Spin dimulai (broadcast ke semua)
  MP.socket.on('spin:start', ({ totalRotation, duration, startAngle }) => {
    mpAnimateSpin(totalRotation, duration, startAngle);
  });

  // Hasil spin (broadcast ke semua)
  MP.socket.on('spin:result', ({ winner, spunBy }) => {
    // Animasi selesai sudah dihandle di mpAnimateSpin
    // Ini fallback jika animasi belum selesai
    setTimeout(() => {
      showMpResult(winner, spunBy);
    }, 100);
  });

  // Error dari server
  MP.socket.on('error', ({ message }) => {
    showLobbyError(message);
    showToast(message, 'error');
  });
}

// ── Create / Join Room ────────────────────────────────────────
function createRoom() {
  if (!MP.connected) { showLobbyError('Tidak terhubung ke server!'); return; }

  const nameInput = document.getElementById('hostNameInput');
  const name = nameInput.value.trim();
  if (!name) { showLobbyError('Masukkan nama kamu dulu!'); return; }

  MP.myName = name;
  hideLobbyError();

  document.getElementById('btnCreateRoom').disabled = true;
  document.getElementById('btnCreateRoom').textContent = 'Membuat…';

  MP.socket.emit('room:create', { name });
}

function joinRoom() {
  if (!MP.connected) { showLobbyError('Tidak terhubung ke server!'); return; }

  const nameInput = document.getElementById('joinNameInput');
  const codeInput = document.getElementById('joinCodeInput');
  const name = nameInput.value.trim();
  const code = codeInput.value.trim().toUpperCase();

  if (!name) { showLobbyError('Masukkan nama kamu dulu!'); return; }
  if (!code || code.length !== 6) { showLobbyError('Kode room harus 6 karakter!'); return; }

  MP.myName = name;
  hideLobbyError();

  document.getElementById('btnJoinRoom').disabled = true;
  document.getElementById('btnJoinRoom').textContent = 'Bergabung…';

  MP.socket.emit('room:join', { name, roomCode: code });
}

function leaveRoom() {
  if (MP.socket && MP.roomCode) {
    MP.socket.emit('room:leave', { roomCode: MP.roomCode });
  }
  // ── Hentikan backsound saat keluar room ──────────────────
  if (window.AudioController) AudioController.stopBacksound();
  resetToLobby();
}

function resetToLobby() {
  MP.roomCode   = null;
  MP.isHost     = false;
  MP.players    = [];
  MP.options    = [];
  MP.isSpinning = false;
  MP.angle      = 0;

  if (MP.animationId) { cancelAnimationFrame(MP.animationId); MP.animationId = null; }

  showScreen('screenLobby');
  hideLobbyError();

  document.getElementById('btnCreateRoom').disabled = false;
  document.getElementById('btnCreateRoom').textContent = '+ Buat Room';
  document.getElementById('btnJoinRoom').disabled = false;
  document.getElementById('btnJoinRoom').textContent = '→ Gabung';

  clearFeed();
}

// ── Options Management (Host only) ────────────────────────────
function mpAddOption() {
  if (!MP.isHost) return;
  const input = document.getElementById('mpOptionInput');
  const text  = input.value.trim();

  if (!text) { showToast('Masukkan teks pilihan!', 'error'); return; }
  if (MP.options.length >= 12) { showToast('Maksimal 12 pilihan!', 'error'); return; }
  if (MP.options.includes(text)) { showToast('Pilihan sudah ada!', 'error'); return; }

  MP.options.push(text);
  input.value = '';
  input.focus();
  mpSyncOptions();
}

function mpRemoveOption(index) {
  if (!MP.isHost) return;
  MP.options.splice(index, 1);
  mpSyncOptions();
}

function mpLoadPreset(key) {
  if (!MP.isHost) return;
  const preset = MP_PRESETS[key];
  if (!preset) return;
  MP.options = [...preset];
  mpSyncOptions();
  showToast(`Preset "${key}" dimuat! ✓`, 'success');
}

function mpSyncOptions() {
  mpRenderOptions();
  drawMpWheel();
  if (MP.socket && MP.roomCode) {
    MP.socket.emit('room:updateOptions', {
      roomCode: MP.roomCode,
      options: MP.options
    });
  }
}

function mpRenderOptions() {
  const list    = document.getElementById('mpOptionsList');
  const counter = document.getElementById('mpOptionCount');
  counter.textContent = MP.options.length;

  if (MP.options.length === 0) {
    list.innerHTML = `
      <div class="empty-options">
        <span class="empty-icon">🎯</span>
        <p>Tambahkan pilihan!</p>
      </div>`;
    return;
  }

  list.innerHTML = MP.options.map((opt, i) => `
    <div class="option-item" style="--color: ${MP_COLORS[i % MP_COLORS.length]}">
      <span class="option-dot"></span>
      <span class="option-text">${escapeHtmlMp(opt)}</span>
      ${MP.isHost ? `<button class="option-remove" onclick="mpRemoveOption(${i})" title="Hapus">✕</button>` : ''}
    </div>
  `).join('');
}

// ── Canvas / Wheel ─────────────────────────────────────────────
function drawMpWheel(highlightIndex = -1) {
  const canvas = document.getElementById('mpWheelCanvas');
  if (!canvas) return;
  const ctx  = canvas.getContext('2d');
  const size = canvas.width;
  const cx   = size / 2;
  const cy   = size / 2;
  const radius = cx - 10;

  ctx.clearRect(0, 0, size, size);

  if (MP.options.length === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#1e1e2e';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#555';
    ctx.font = 'bold 13px Sora, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Menunggu pilihan…', cx, cy);
    return;
  }

  const arc = (Math.PI * 2) / MP.options.length;

  MP.options.forEach((opt, i) => {
    const startAngle = arc * i + MP.angle;
    const endAngle   = startAngle + arc;
    const color      = MP_COLORS[i % MP_COLORS.length];
    const isHl       = i === highlightIndex;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, isHl ? radius + 5 : radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = isHl ? lightenMpColor(color, 30) : color;
    ctx.fill();
    ctx.strokeStyle = '#0f0f1a';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startAngle + arc / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 3;
    const fontSize = MP.options.length > 8 ? 10 : 12;
    ctx.font = `bold ${fontSize}px Sora, sans-serif`;
    let label = opt;
    if (label.length > 13) label = label.substring(0, 11) + '…';
    ctx.fillText(label, radius - 14, 4);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, Math.PI * 2);
  ctx.fillStyle = '#0f0f1a';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🌐', cx, cy);
}

function resizeMpCanvas() {
  const canvas    = document.getElementById('mpWheelCanvas');
  const container = document.getElementById('mpWheelContainer');
  if (!canvas || !container) return;
  const size = Math.min(container.offsetWidth, container.offsetHeight, 360);
  canvas.width  = size;
  canvas.height = size;
  drawMpWheel();
}

// ── Spin ──────────────────────────────────────────────────────
function mpSpinWheel() {
  if (!MP.isHost) return;
  if (MP.isSpinning) return;
  if (MP.options.length < 2) {
    showToast('Tambahkan minimal 2 pilihan!', 'error');
    return;
  }

  const totalRotation = Math.PI * 2 * (5 + Math.random() * 5);
  const duration      = 4000 + Math.random() * 1000;

  // Broadcast ke semua (termasuk diri sendiri via server)
  MP.socket.emit('spin:start', {
    roomCode: MP.roomCode,
    totalRotation,
    duration,
    startAngle: MP.angle,
  });
}

function mpAnimateSpin(totalRotation, duration, startAngle) {
  if (MP.isSpinning) return;
  MP.isSpinning = true;

  document.getElementById('mpSpinBtn').disabled = true;
  document.getElementById('mpSpinBtn').textContent = '🌀 Berputar…';

  // ── Spin SFX ──────────────────────────────────────────────
  if (window.AudioController) AudioController.playSpinSound();

  const start = performance.now();

  function easeOut(t) { return 1 - Math.pow(1 - t, 4); }

  function animate(now) {
    const elapsed  = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased    = easeOut(progress);

    MP.angle = startAngle + totalRotation * eased;
    drawMpWheel();

    if (progress < 1) {
      MP.animationId = requestAnimationFrame(animate);
    } else {
      // Kalkulasi pemenang
      const arc = (Math.PI * 2) / MP.options.length;
      const normalizedAngle = ((MP.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const pointerAngle    = (Math.PI * 2 - normalizedAngle) % (Math.PI * 2);
      const winnerIndex     = Math.floor(pointerAngle / arc) % MP.options.length;
      const winner          = MP.options[winnerIndex];

      drawMpWheel(winnerIndex);

      // ── Stop Spin SFX ──────────────────────────────────────────────
      if (window.AudioController) AudioController.stopSpinSound();

      // Hanya host yang emit hasil
      if (MP.isHost) {
        MP.socket.emit('spin:result', {
          roomCode: MP.roomCode,
          winner,
          winnerIndex,
          spunBy: MP.myName,
        });
      }

      MP.isSpinning = false;
      document.getElementById('mpSpinBtn').disabled = false;
      document.getElementById('mpSpinBtn').textContent = '🎰 PUTAR BARENG!';
    }
  }

  MP.animationId = requestAnimationFrame(animate);
}

function showMpResult(winner, spunBy) {
  document.getElementById('mpResultText').textContent = winner;
  document.getElementById('mpResultSpunBy').textContent = spunBy ? `Diputar oleh ${spunBy}` : '';
  document.getElementById('mpResultOverlay').classList.add('visible');
  launchMpConfetti();
  addFeedItem('🏆', `Hasil spin: <strong>${winner}</strong> (oleh ${spunBy || 'host'})`);
}

function closeMpResult() {
  document.getElementById('mpResultOverlay').classList.remove('visible');
}

// ── UI Helpers ─────────────────────────────────────────────────
function showScreen(screenId) {
  document.getElementById('screenLobby').style.display = 'none';
  document.getElementById('screenRoom').style.display  = 'none';
  document.getElementById(screenId).style.display      = 'block';

  if (screenId === 'screenRoom') {
    setTimeout(resizeMpCanvas, 100);
    window.addEventListener('resize', resizeMpCanvas);
    // ── Mulai backsound saat masuk room ──────────────────────
    if (window.AudioController) AudioController.startBacksound();
  }
}

function updateRoomHeader() {
  document.getElementById('roomCodeDisplay').textContent = MP.roomCode;
  const hostPlayer = MP.players.find(p => p.isHost);
  const hostName   = hostPlayer ? hostPlayer.name : '—';
  document.getElementById('roomHostInfo').textContent = `Host: ${hostName}`;
  mpUpdateHostUI();
}

function mpUpdateHostUI() {
  const addRow    = document.getElementById('mpAddRow');
  const spinBtn   = document.getElementById('mpSpinBtn');
  const waitMsg   = document.getElementById('mpWaitingMsg');
  const opPanel   = document.getElementById('mpOptionsPanel');

  if (MP.isHost) {
    addRow.style.display  = 'flex';
    spinBtn.style.display = 'block';
    waitMsg.style.display = 'none';
    opPanel.style.opacity = '1';
  } else {
    addRow.style.display  = 'none';
    spinBtn.style.display = 'none';
    waitMsg.style.display = 'block';
    opPanel.style.opacity = '0.7';
  }
}

function renderPlayers() {
  const grid  = document.getElementById('mpPlayersGrid');
  const count = document.getElementById('mpPlayerCount');
  count.textContent = MP.players.length;

  grid.innerHTML = MP.players.map(p => {
    const isYou  = p.socketId === (MP.socket && MP.socket.id) || p.name === MP.myName;
    const isHost = p.isHost;
    let classes  = 'mp-player-chip';
    if (isHost) classes += ' is-host';
    if (isYou)  classes += ' is-you';

    const badges = [
      isHost ? '<span class="mp-player-badge mp-badge-host">👑 Host</span>' : '',
      isYou  ? '<span class="mp-player-badge mp-badge-you">Kamu</span>'    : '',
    ].filter(Boolean).join('');

    return `
      <div class="${classes}">
        <div class="mp-player-avatar">${p.name.charAt(0).toUpperCase()}</div>
        <span class="mp-player-name">${escapeHtmlMp(p.name)}</span>
        ${badges}
      </div>
    `;
  }).join('');
}

function copyRoomCode() {
  if (!MP.roomCode) return;
  navigator.clipboard.writeText(MP.roomCode).then(() => {
    showToast('Kode room disalin! 📋', 'success');
  }).catch(() => {
    // Fallback
    const el = document.createElement('textarea');
    el.value = MP.roomCode;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('Kode room disalin! 📋', 'success');
  });
}

function addFeedItem(icon, html) {
  const feed    = document.getElementById('mpFeed');
  const emptyEl = feed.querySelector('.mp-feed-empty');
  if (emptyEl) emptyEl.remove();

  const now  = new Date();
  const time = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const item = document.createElement('div');
  item.className = 'mp-feed-item';
  item.innerHTML = `
    <span class="mp-feed-icon">${icon}</span>
    <span class="mp-feed-text">${html}</span>
    <span class="mp-feed-time">${time}</span>
  `;
  feed.insertBefore(item, feed.firstChild);

  // Keep max 30 items
  while (feed.children.length > 30) feed.removeChild(feed.lastChild);
}

function clearFeed() {
  const feed = document.getElementById('mpFeed');
  feed.innerHTML = '<div class="mp-feed-empty">Bergabung ke room untuk melihat aktivitas…</div>';
}

function updateServerStatus(state, text) {
  const dot  = document.getElementById('statusDot');
  const span = document.getElementById('statusText');
  if (!dot || !span) return;
  dot.className  = `mp-status-dot ${state}`;
  span.textContent = text;
}

function enableLobbyButtons(enabled) {
  const btn1 = document.getElementById('btnCreateRoom');
  const btn2 = document.getElementById('btnJoinRoom');
  if (btn1) btn1.disabled = !enabled;
  if (btn2) btn2.disabled = !enabled;
}

function showLobbyError(msg) {
  const el = document.getElementById('lobbyError');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
}

function hideLobbyError() {
  const el = document.getElementById('lobbyError');
  if (el) el.style.display = 'none';
}

function showOfflineMessage() {
  const overlay = document.createElement('div');
  overlay.className = 'mp-offline-overlay';
  overlay.innerHTML = `
    <div class="mp-offline-icon">🔌</div>
    <div class="mp-offline-title">Server Tidak Tersedia</div>
    <div class="mp-offline-sub">
      Backend realtime belum berjalan.<br>
      Jalankan server Socket.IO terlebih dahulu.
    </div>
    <button class="mp-btn-reconnect" onclick="location.reload()">🔄 Coba Lagi</button>
    <a href="dashboard.html" style="color:var(--accent-4);font-size:0.9rem;margin-top:8px">← Kembali ke Spin</a>
  `;
  document.body.appendChild(overlay);
}

// ── Confetti ──────────────────────────────────────────────────
function launchMpConfetti() {
  const colors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF'];
  for (let i = 0; i < 60; i++) {
    const dot = document.createElement('div');
    dot.className = 'confetti-dot';
    dot.style.cssText = `
      left: ${Math.random() * 100}vw;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-delay: ${Math.random() * 0.5}s;
      width: ${4 + Math.random() * 8}px;
      height: ${4 + Math.random() * 8}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
    `;
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 2500);
  }
}

// ── Utilities ─────────────────────────────────────────────────
function lightenMpColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

function escapeHtmlMp(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast toast-${type} visible`;
  setTimeout(() => toast.classList.remove('visible'), 3000);
}
