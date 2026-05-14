// ============================================================
// truth-dare.js — LOGIKA RODA PUTAR (WHEEL) TRUTH OR DARE
// ============================================================

let players = [];
let customTruths = [];
let customDares = [];

let selectedPlayer = '';
let selectedMode = '';
let isSpinning = false;
let currentRotation = 0; 
let animationFrameId = null;

const wheelColors = ['#FF6B6B', '#4D96FF', '#FFD93D', '#6BCB77', '#C77DFF', '#FF9A3C'];

// ── INIT & SETUP ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const savedPlayers = localStorage.getItem('td_players');
  if (savedPlayers) {
    players = JSON.parse(savedPlayers);
    renderPlayers();
  }
});

function addPlayer() {
  const input = document.getElementById('playerNameInput');
  const name = input.value.trim().toUpperCase();
  if (!name) return;
  if (players.includes(name)) {
    showToast('Nama sudah ada!', 'error');
    return;
  }
  players.push(name);
  localStorage.setItem('td_players', JSON.stringify(players));
  renderPlayers();
  input.value = '';
}

function handlePlayerKey(e) {
  if (e.key === 'Enter') addPlayer();
}

function removePlayer(index) {
  players.splice(index, 1);
  localStorage.setItem('td_players', JSON.stringify(players));
  renderPlayers();
}

function renderPlayers() {
  const list = document.getElementById('tdPlayersList');
  if (players.length === 0) {
    list.innerHTML = '<div class="td-no-players">Belum ada pemain. Tambahkan minimal 2 orang!</div>';
    return;
  }
  list.innerHTML = players.map((name, i) => `
    <div class="td-player-chip">
      <span>${escapeHtml(name)}</span>
      <button class="td-player-remove" onclick="removePlayer(${i})">✕</button>
    </div>
  `).join('');
}

// ── MENGGAMBAR RODA DI KANVAS ─────────────────────────────────
function drawWheel(items) {
  const canvas = document.getElementById('tdWheel');
  const ctx = canvas.getContext('2d');
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const radius = cx;
  const arc = (2 * Math.PI) / items.length;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = 0; i < items.length; i++) {
    const angle = i * arc;
    
    ctx.beginPath();
    ctx.fillStyle = wheelColors[i % wheelColors.length];
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, radius, angle, angle + arc);
    ctx.lineTo(cx, cy);
    ctx.fill();
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle + arc / 2);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 15px sans-serif';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 4;
    
    let text = items[i];
    if (text.length > 20) text = text.substring(0, 18) + '...';
    
    ctx.fillText(text, radius - 20, 0);
    ctx.restore();
  }
}

function resetWheelPosition() {
  if(animationFrameId) cancelAnimationFrame(animationFrameId);
  currentRotation = 0;
  const canvas = document.getElementById('tdWheel');
  canvas.style.transform = `rotate(0deg)`;
}

// ── FUNGSI PUTAR FISIK ────────────────────────────────────────
function spinTheWheel(items, onComplete) {
  if(isSpinning) return;
  isSpinning = true;

  const canvas = document.getElementById('tdWheel');
  const winnerIndex = Math.floor(Math.random() * items.length);
  const arcDeg = 360 / items.length;
  const sliceCenter = (winnerIndex * arcDeg) + (arcDeg / 2);
  const targetRotation = (270 - sliceCenter + 360) % 360;

  const baseSpins = 5 * 360; 
  let currentMod = currentRotation % 360;
  if (currentMod < 0) currentMod += 360; 
  let dist = targetRotation - currentMod;
  if (dist <= 0) dist += 360;

  const totalRotation = currentRotation + baseSpins + dist;
  const startRotation = currentRotation;
  const duration = 4000; 
  const startTime = performance.now();

  document.getElementById('wheelResultText').textContent = 'Memutar Roda... 🎲';

  function easeOutQuart(t) {
    return 1 - (--t) * t * t * t;
  }

  function animate(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easedProgress = easeOutQuart(progress);

    currentRotation = startRotation + (totalRotation - startRotation) * easedProgress;
    canvas.style.transform = `rotate(${currentRotation}deg)`;

    if (progress < 1) {
      animationFrameId = requestAnimationFrame(animate);
    } else {
      isSpinning = false;
      document.getElementById('wheelResultText').textContent = items[winnerIndex];
      onComplete(items[winnerIndex]);
    }
  }
  animationFrameId = requestAnimationFrame(animate);
}

// ── FASE TRANSISI ─────────────────────────────────────────────
function startGame() {
  if (players.length < 2) {
    showToast('Minimal butuh 2 pemain bosku!', 'error');
    return;
  }
  
  customTruths = document.getElementById('truthInput').value.split('\n').filter(t => t.trim() !== '');
  customDares = document.getElementById('dareInput').value.split('\n').filter(d => d.trim() !== '');

  if (customTruths.length === 0 || customDares.length === 0) {
    showToast('Isian Truth dan Dare tidak boleh kosong!', 'error');
    return;
  }

  document.getElementById('setupSection').style.display = 'none';
  document.getElementById('playSection').style.display = 'block';
  
  startNewRound();
}

function backToSetup() {
  document.getElementById('setupSection').style.display = 'block';
  document.getElementById('playSection').style.display = 'none';
}

function startNewRound() {
  document.getElementById('playTitle').textContent = 'Giliran Siapa Selanjutnya?';
  document.getElementById('wheelResultText').textContent = 'Tunggu Diputar...';
  
  document.getElementById('btnSpinName').style.display = 'block';
  document.getElementById('choiceArea').style.display = 'none';
  document.getElementById('btnSpinTask').style.display = 'none';
  document.getElementById('btnNextRound').style.display = 'none';

  resetWheelPosition();
  drawWheel(players);
}

// ── ALUR 1: SPIN NAMA ─────────────────────────────────────────
function doSpinName() {
  document.getElementById('btnSpinName').style.display = 'none';
  
  spinTheWheel(players, (winner) => {
    selectedPlayer = winner;
    document.getElementById('choiceArea').style.display = 'block';
    document.getElementById('chosenNameHighlight').textContent = selectedPlayer;
  });
}

// ── ALUR 2: PILIH TRUTH / DARE ────────────────────────────────
function doChooseMode(mode) {
  selectedMode = mode;
  document.getElementById('choiceArea').style.display = 'none';
  document.getElementById('btnSpinTask').style.display = 'block';
  
  const title = mode === 'truth' ? 'TRUTH 🧠' : 'DARE 🔥';
  document.getElementById('playTitle').textContent = `Mengacak ${title} untuk ${selectedPlayer}`;
  document.getElementById('wheelResultText').textContent = 'Tunggu Diputar...';
  
  resetWheelPosition();
  const pool = mode === 'truth' ? customTruths : customDares;
  drawWheel(pool);
}

// ── ALUR 3: SPIN TANTANGAN ────────────────────────────────────
function doSpinTask() {
  document.getElementById('btnSpinTask').style.display = 'none';
  
  const pool = selectedMode === 'truth' ? customTruths : customDares;
  
  spinTheWheel(pool, (task) => {
    document.getElementById('btnNextRound').style.display = 'block';
    
    if (selectedMode === 'dare') launchMiniConfetti();

    // Munculkan Pop-up setelah jeda 0.5 detik biar asik
    setTimeout(() => {
      showResultModal(task);
    }, 500);
  });
}

// ── POP-UP MODAL ──────────────────────────────────────────────
function showResultModal(task) {
  const modal = document.getElementById('resultModal');
  const badge = document.getElementById('modalBadge');

  document.getElementById('modalPlayerName').textContent = selectedPlayer;
  document.getElementById('modalTaskText').textContent = task;

  if (selectedMode === 'truth') {
    badge.textContent = '🧠 TRUTH';
    badge.className = 'td-modal-badge truth';
  } else {
    badge.textContent = '🔥 DARE';
    badge.className = 'td-modal-badge dare';
  }

  modal.style.display = 'flex';
}

function closeResultModal() {
  document.getElementById('resultModal').style.display = 'none';
}

// ── UTILITIES ─────────────────────────────────────────────────
function escapeHtml(text) {
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

function launchMiniConfetti() {
  const colors = ['#FF6B6B', '#FFD93D', '#FF9A3C', '#4D96FF', '#C77DFF'];
  for (let i = 0; i < 40; i++) {
    const dot = document.createElement('div');
    dot.className = 'confetti-dot';
    dot.style.cssText = `
      left: ${Math.random() * 100}vw;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-delay: ${Math.random() * 0.3}s;
      width: ${8 + Math.random() * 10}px;
      height: ${8 + Math.random() * 10}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
    `;
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 2500);
  }
}