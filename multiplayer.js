// ============================================================
// multiplayer.js — LOGIKA REALTIME MULTIPLAYER (Supabase)
// Kompatibel dengan Flutter spin_bareng_screen.dart
// Channel  : room:{CODE}  (Supabase Broadcast)
// Events   : member_join | member_leave | full_state
//            options_update | request_state
//            spin_start | spin_result
// ============================================================

// ── State ─────────────────────────────────────────────────────
const MP = {
  channel:    null,   // RealtimeChannel Supabase
  roomCode:   null,
  myName:     null,
  isHost:     false,
  players:    [],     // [{ name, isHost }]
  options:    [],     // string[]
  isSpinning: false,
  angle:      0,
  animationId: null,
  connected:  false,
  retryCount: 0,
  retryTimer: null,
};

const MP_COLORS = [
  '#4D96FF', '#FF6B6B', '#51CF66',
  '#FFD43B', '#CC5DE8', '#FF922B',
  '#20C997', '#E64980',
];

const MP_PRESETS = {
  makan:   ['Nasi Goreng', 'Mie Ayam', 'Bakso', 'Pecel Lele', 'Soto', 'Warteg'],
  weekend: ['Main game', 'Nonton film', 'Tidur', 'Jalan-jalan', 'Baca buku', 'Olahraga'],
};

// ── Init ──────────────────────────────────────────────────────
// dipanggil dari HTML setelah Supabase client siap
function initMultiplayer(defaultName) {
  MP.myName = defaultName;

  // Tunggu Supabase client tersedia (dari supabase.js)
  waitForSupabase(() => {
    MP.connected = true;
    updateServerStatus('connected', 'Terhubung ke Supabase');
    enableLobbyButtons(true);
  });

  window.addEventListener('beforeunload', () => {
    if (MP.channel && MP.roomCode) {
      getSupabase().channel(`room:${MP.roomCode}`).send({
        type: 'broadcast', event: 'member_leave',
        payload: { name: MP.myName },
      });
    }
    if (window.AudioController) AudioController.stopBacksound();
  });
}

// ── FIX: Ambil instance Supabase client dengan validasi .channel() ──
function getSupabase() {
  const client = window._supabaseClient || window.supabaseClient || null;
  // Pastikan yang dikembalikan benar-benar Supabase client (punya .channel)
  // bukan CDN library object (window.supabase = library, bukan instance)
  if (client && typeof client.channel === 'function') return client;
  return null;
}

// ── FIX: Tunggu Supabase client tersedia dan valid ──
function waitForSupabase(cb, tries = 0) {
  const sb = getSupabase();
  if (sb) { cb(); return; }
  if (tries > 30) {
    updateServerStatus('disconnected', 'Supabase tidak tersedia');
    return;
  }
  updateServerStatus('connecting', 'Menghubungkan ke Supabase…');
  setTimeout(() => waitForSupabase(cb, tries + 1), 300);
}

// ── Create / Join Room ────────────────────────────────────────
function createRoom() {
  if (!getSupabase()) { showLobbyError('Supabase belum siap!'); return; }

  const name = document.getElementById('hostNameInput').value.trim();
  if (!name) { showLobbyError('Masukkan nama kamu dulu!'); return; }

  MP.myName = name;
  hideLobbyError();
  setBtnLoading('btnCreateRoom', 'Membuat…');

  // Buat kode room 6 huruf (sama seperti Flutter _generateCode)
  const code = Array.from({ length: 6 }, () =>
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]
  ).join('');

  MP.isHost = true;
  _enterRoom(code, name, true);
}

function joinRoom() {
  if (!getSupabase()) { showLobbyError('Supabase belum siap!'); return; }

  const name = document.getElementById('joinNameInput').value.trim();
  const code = document.getElementById('joinCodeInput').value.trim().toUpperCase();

  if (!name) { showLobbyError('Masukkan nama kamu dulu!'); return; }
  if (!code || code.length !== 6) { showLobbyError('Kode room harus 6 karakter!'); return; }

  MP.myName = name;
  hideLobbyError();
  setBtnLoading('btnJoinRoom', 'Bergabung…');

  MP.isHost = false;
  _enterRoom(code, name, false);
}

function _enterRoom(code, name, isHost) {
  MP.roomCode = code;
  MP.isHost   = isHost;
  MP.players  = isHost ? [{ name, isHost: true }] : [];
  MP.options  = [];

  _subscribeRoom(code, name, isHost);
}

// ── Supabase Realtime Channel ─────────────────────────────────
function _subscribeRoom(code, name, isHost) {
  const sb = getSupabase();

  // Unsubscribe channel lama jika ada
  if (MP.channel) { MP.channel.unsubscribe(); MP.channel = null; }

  MP.channel = sb.channel(`room:${code}`, {
    config: { broadcast: { self: false } },
  });

  // ── member_join ─────────────────────────────────────────────
  // Flutter: payload = { member: { name, isHost } }
  MP.channel.on('broadcast', { event: 'member_join' }, ({ payload }) => {
    const member = payload?.member;
    if (!member) return;
    if (!MP.players.some(p => p.name === member.name)) {
      MP.players.push(member);
    }
    renderPlayers();
    addFeedItem('👋', `<strong>${escapeHtmlMp(member.name)}</strong> bergabung ke room`);
    showToast(`${member.name} bergabung! 👋`, 'success');
    // Host kirim full state ke pendatang baru
    if (MP.isHost) _broadcastFullState();
  });

  // ── member_leave ────────────────────────────────────────────
  // Flutter: payload = { name }
  MP.channel.on('broadcast', { event: 'member_leave' }, ({ payload }) => {
    const leavingName = payload?.name;
    if (!leavingName) return;
    MP.players = MP.players.filter(p => p.name !== leavingName);
    renderPlayers();
    addFeedItem('🚪', `<strong>${escapeHtmlMp(leavingName)}</strong> keluar dari room`);
  });

  // ── full_state ──────────────────────────────────────────────
  // Flutter: payload = { members: [...], options: [...] }
  MP.channel.on('broadcast', { event: 'full_state' }, ({ payload }) => {
    if (payload?.members) {
      MP.players = payload.members;
      renderPlayers();
    }
    if (payload?.options) {
      MP.options = payload.options;
      mpRenderOptions();
      drawMpWheel();
    }
    _stopRetry();
    updateRoomHeader();
    addFeedItem('🔄', 'State room diterima dari host');
  });

  // ── options_update ──────────────────────────────────────────
  // Flutter: payload = { options: [...] }
  MP.channel.on('broadcast', { event: 'options_update' }, ({ payload }) => {
    if (!payload?.options) return;
    MP.options = payload.options;
    mpRenderOptions();
    drawMpWheel();
    addFeedItem('✏️', 'Host memperbarui pilihan roda');
  });

  // ── request_state ───────────────────────────────────────────
  // Flutter: payload = { from: name }
  // Host merespon dengan full_state
  MP.channel.on('broadcast', { event: 'request_state' }, ({ payload }) => {
    if (MP.isHost) _broadcastFullState();
  });

  // ── spin_start ──────────────────────────────────────────────
  // Flutter: payload = { rotation, duration }
  // Catatan: Flutter tidak kirim startAngle, jadi kita pakai MP.angle
  MP.channel.on('broadcast', { event: 'spin_start' }, ({ payload }) => {
    const rotation = payload?.rotation ?? payload?.totalRotation ?? 0;
    const duration = payload?.duration ?? 4500;
    mpAnimateSpin(rotation, duration, MP.angle);
    addFeedItem('🎰', 'Roda sedang berputar…');
  });

  // ── spin_result ─────────────────────────────────────────────
  // Flutter: payload = { result }
  MP.channel.on('broadcast', { event: 'spin_result' }, ({ payload }) => {
    const result  = payload?.result || payload?.winner || '?';
    const spunBy  = payload?.spunBy || null;
    // Tampilkan hasil dengan sedikit delay agar animasi selesai dulu
    setTimeout(() => showMpResult(result, spunBy), 200);
  });

  // ── Subscribe ───────────────────────────────────────────────
  MP.channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      _onChannelReady(code, name, isHost);
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      showLobbyError('Gagal terhubung ke room. Coba lagi.');
      resetToLobby();
    }
  });
}

function _onChannelReady(code, name, isHost) {
  // Umumkan kehadiran ke semua member (termasuk Flutter)
  setTimeout(() => {
    MP.channel.send({
      type: 'broadcast', event: 'member_join',
      payload: { member: { name, isHost } },
    });

    // Guest: minta full state dari host (mirip Flutter _startRetryRequestState)
    if (!isHost) _startRetryRequestState();
  }, 600);

  // Tampilkan screen room
  showScreen('screenRoom');
  updateRoomHeader();
  mpRenderOptions();
  drawMpWheel();
  resizeMpCanvas();

  addFeedItem('🎉', `Kamu bergabung ke room <strong>${code}</strong>`);
  showToast(`Bergabung ke room ${code}! 🎉`, 'success');
}

// ── Full State Broadcast ──────────────────────────────────────
// Payload identik dengan Flutter _broadcastFullState
function _broadcastFullState() {
  if (!MP.channel || !MP.isHost) return;
  MP.channel.send({
    type: 'broadcast', event: 'full_state',
    payload: {
      members: MP.players,
      options: MP.options,
    },
  });
}

// ── Retry Request State (untuk guest) ────────────────────────
// Mirip Flutter _startRetryRequestState / _doRetry
function _startRetryRequestState() {
  MP.retryCount = 0;
  _doRetry();
}

function _doRetry() {
  if (MP.retryCount >= 6) return;
  if (MP.options.length > 0) return; // sudah dapat state
  MP.retryCount++;
  if (MP.channel) {
    MP.channel.send({
      type: 'broadcast', event: 'request_state',
      payload: { from: MP.myName },
    });
  }
  MP.retryTimer = setTimeout(_doRetry, 1500);
}

function _stopRetry() {
  MP.retryCount = 99;
  if (MP.retryTimer) { clearTimeout(MP.retryTimer); MP.retryTimer = null; }
}

// ── Leave Room ────────────────────────────────────────────────
function leaveRoom() {
  _stopRetry();
  if (MP.channel && MP.roomCode) {
    MP.channel.send({
      type: 'broadcast', event: 'member_leave',
      payload: { name: MP.myName },
    });
    MP.channel.unsubscribe();
    MP.channel = null;
  }
  if (window.AudioController) AudioController.stopBacksound();
  resetToLobby();
}

function resetToLobby() {
  _stopRetry();
  MP.roomCode   = null;
  MP.isHost     = false;
  MP.players    = [];
  MP.options    = [];
  MP.isSpinning = false;
  MP.angle      = 0;

  if (MP.animationId) {
    cancelAnimationFrame(MP.animationId);
    MP.animationId = null;
  }

  showScreen('screenLobby');
  hideLobbyError();
  setBtnLoading('btnCreateRoom', '+ Buat Room', false);
  setBtnLoading('btnJoinRoom', '→ Gabung', false);
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

// Broadcast options ke semua (Flutter + web lain)
// Payload: { options: [...] } — sama dengan Flutter
function mpSyncOptions() {
  mpRenderOptions();
  drawMpWheel();
  if (MP.channel && MP.roomCode) {
    MP.channel.send({
      type: 'broadcast', event: 'options_update',
      payload: { options: MP.options },
    });
  }
}

function mpRenderOptions() {
  const list    = document.getElementById('mpOptionsList');
  const counter = document.getElementById('mpOptionCount');
  if (!list) return;
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

// ── Canvas / Wheel ────────────────────────────────────────────
function drawMpWheel(highlightIndex = -1) {
  const canvas = document.getElementById('mpWheelCanvas');
  if (!canvas) return;
  const ctx    = canvas.getContext('2d');
  const size   = canvas.width;
  const cx = size / 2, cy = size / 2;
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
    ctx.fillStyle = isHl ? lightenMpColor(color, 40) : color;
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

  // Center dot
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

  const rotation = Math.PI * 2 * (5 + Math.random() * 5);
  const duration = Math.floor(4000 + Math.random() * 1000);

  // Broadcast ke semua (Flutter + web lain)
  // Payload: { rotation, duration } — sama dengan Flutter _hostStartSpin
  if (MP.channel) {
    MP.channel.send({
      type: 'broadcast', event: 'spin_start',
      payload: { rotation, duration },
    });
  }

  // Langsung spin di sisi host juga
  mpAnimateSpin(rotation, duration, MP.angle);
}

function mpAnimateSpin(totalRotation, duration, startAngle) {
  if (MP.isSpinning) return;
  MP.isSpinning = true;

  const spinBtn = document.getElementById('mpSpinBtn');
  if (spinBtn) { spinBtn.disabled = true; spinBtn.textContent = '🌀 Berputar…'; }

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
      // Hitung pemenang (logika sama dengan Flutter _onLocalSpinDone)
      const arc = (Math.PI * 2) / MP.options.length;
      const normalized  = ((MP.angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const pointerAngle = (Math.PI * 2 - normalized) % (Math.PI * 2);
      const winnerIndex  = Math.floor(pointerAngle / arc) % MP.options.length;
      const winner       = MP.options[winnerIndex];

      drawMpWheel(winnerIndex);

      if (window.AudioController) AudioController.stopSpinSound();

      // Host broadcast hasil ke semua (Flutter + web lain)
      // Payload: { result } — sama dengan Flutter _onLocalSpinDone
      if (MP.isHost && MP.channel) {
        MP.channel.send({
          type: 'broadcast', event: 'spin_result',
          payload: { result: winner, spunBy: MP.myName },
        });
      }

      MP.isSpinning = false;
      if (spinBtn) { spinBtn.disabled = false; spinBtn.textContent = '🎰 PUTAR BARENG!'; }

      showMpResult(winner, MP.isHost ? MP.myName : null);
    }
  }

  MP.animationId = requestAnimationFrame(animate);
}

function showMpResult(winner, spunBy) {
  document.getElementById('mpResultText').textContent = winner;
  const spunByEl = document.getElementById('mpResultSpunBy');
  if (spunByEl) spunByEl.textContent = spunBy ? `Diputar oleh ${spunBy}` : '';
  document.getElementById('mpResultOverlay').classList.add('visible');
  launchMpConfetti();
  addFeedItem('🏆', `Hasil spin: <strong>${escapeHtmlMp(winner)}</strong>${spunBy ? ` (oleh ${escapeHtmlMp(spunBy)})` : ''}`);
}

function closeMpResult() {
  document.getElementById('mpResultOverlay').classList.remove('visible');
}

// ── UI Helpers ─────────────────────────────────────────────────
function showScreen(screenId) {
  ['screenLobby', 'screenRoom'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const target = document.getElementById(screenId);
  if (target) target.style.display = 'block';

  if (screenId === 'screenRoom') {
    setTimeout(resizeMpCanvas, 100);
    window.addEventListener('resize', resizeMpCanvas);
    if (window.AudioController) AudioController.startBacksound();
  }
}

function updateRoomHeader() {
  const codeEl = document.getElementById('roomCodeDisplay');
  if (codeEl) codeEl.textContent = MP.roomCode || '------';

  const hostPlayer = MP.players.find(p => p.isHost);
  const hostName   = hostPlayer ? hostPlayer.name : '—';
  const hostInfo   = document.getElementById('roomHostInfo');
  if (hostInfo) hostInfo.textContent = `Host: ${hostName}`;

  mpUpdateHostUI();
}

function mpUpdateHostUI() {
  const addRow  = document.getElementById('mpAddRow');
  const spinBtn = document.getElementById('mpSpinBtn');
  const waitMsg = document.getElementById('mpWaitingMsg');
  const opPanel = document.getElementById('mpOptionsPanel');
  if (!addRow) return;

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
  if (!grid) return;
  count.textContent = MP.players.length;

  grid.innerHTML = MP.players.map(p => {
    const isYou  = p.name === MP.myName;
    const isHost = p.isHost;
    let classes  = 'mp-player-chip';
    if (isHost) classes += ' is-host';
    if (isYou)  classes += ' is-you';

    const badges = [
      isHost ? '<span class="mp-player-badge mp-badge-host">👑 Host</span>' : '',
      isYou  ? '<span class="mp-player-badge mp-badge-you">Kamu</span>' : '',
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
  navigator.clipboard.writeText(MP.roomCode)
    .then(() => showToast('Kode room disalin! 📋', 'success'))
    .catch(() => {
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
  if (!feed) return;
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
  while (feed.children.length > 30) feed.removeChild(feed.lastChild);
}

function clearFeed() {
  const feed = document.getElementById('mpFeed');
  if (feed) feed.innerHTML = '<div class="mp-feed-empty">Bergabung ke room untuk melihat aktivitas…</div>';
}

function updateServerStatus(state, text) {
  const dot  = document.getElementById('statusDot');
  const span = document.getElementById('statusText');
  if (!dot || !span) return;
  dot.className    = `mp-status-dot ${state}`;
  span.textContent = text;
}

function enableLobbyButtons(enabled) {
  const b1 = document.getElementById('btnCreateRoom');
  const b2 = document.getElementById('btnJoinRoom');
  if (b1) b1.disabled = !enabled;
  if (b2) b2.disabled = !enabled;
}

function setBtnLoading(id, text, loading = true) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled     = loading;
  btn.textContent  = text;
}

function showLobbyError(msg) {
  const el = document.getElementById('lobbyError');
  if (!el) return;
  el.textContent   = msg;
  el.style.display = 'block';
}

function hideLobbyError() {
  const el = document.getElementById('lobbyError');
  if (el) el.style.display = 'none';
}

// ── Confetti ──────────────────────────────────────────────────
function launchMpConfetti() {
  const colors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF'];
  for (let i = 0; i < 60; i++) {
    const dot = document.createElement('div');
    dot.className = 'confetti-dot';
    dot.style.cssText = `
      position:fixed; top:-10px;
      left: ${Math.random() * 100}vw;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation: confettiFall 2s ease-in forwards;
      animation-delay: ${Math.random() * 0.5}s;
      width: ${4 + Math.random() * 8}px;
      height: ${4 + Math.random() * 8}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      z-index: 9999;
    `;
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 2500);
  }
}

// ── Utilities ─────────────────────────────────────────────────
function lightenMpColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r   = Math.min(255, (num >> 16) + amount);
  const g   = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b   = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

function escapeHtmlMp(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(String(text)));
  return div.innerHTML;
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className   = `toast toast-${type} visible`;
  setTimeout(() => toast.classList.remove('visible'), 3000);
}