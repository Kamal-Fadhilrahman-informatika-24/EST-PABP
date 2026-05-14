// ============================================================
// double-spin.js — LOGIKA DOUBLE SPIN DENGAN AUTO-REMOVE & INSTANT EXECUTION
// ============================================================

const DS = {
  left:  { items: [], angle: 0, isSpinning: false, canvas: null, ctx: null },
  right: { items: [], angle: 0, isSpinning: false, canvas: null, ctx: null },
};

let dsResults = [];           
let dsIsSpinning = false;     

const DS_COLORS = [
  '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF',
  '#FF9A3C', '#C77DFF', '#00C9A7', '#F72585'
];

const DS_PRESETS = {
  anggota: ['Andi', 'Budi', 'Citra', 'Dian', 'Eko', 'Fita'],
  tugas:   ['Presentasi', 'Dokumentasi', 'Coding', 'Testing', 'Desain', 'Review'],
};

// ── Inisialisasi ──────────────────────────────────────────────
function initDoubleSpinPage() {
  DS.left.canvas  = document.getElementById('leftCanvas');
  DS.left.ctx     = DS.left.canvas.getContext('2d');
  DS.right.canvas = document.getElementById('rightCanvas');
  DS.right.ctx    = DS.right.canvas.getContext('2d');

  const savedLeft  = localStorage.getItem('ds_left_items');
  const savedRight = localStorage.getItem('ds_right_items');
  if (savedLeft)  { try { DS.left.items  = JSON.parse(savedLeft);  } catch(_){} }
  if (savedRight) { try { DS.right.items = JSON.parse(savedRight); } catch(_){} }

  renderDsItems('left');
  renderDsItems('right');
  resizeDsCanvases();
  window.addEventListener('resize', resizeDsCanvases);
}

function resizeDsCanvases() {
  ['left', 'right'].forEach(side => {
    const wrap = document.getElementById(side === 'left' ? 'leftWheelWrap' : 'rightWheelWrap');
    const canvas = DS[side].canvas;
    if (!wrap || !canvas) return;
    const size = Math.min(wrap.offsetWidth - 30, 340);
    canvas.width  = size;
    canvas.height = size;
    drawDsWheel(side);
  });
}

// ── Gambar Roda ────────────────────────────────────────────────
function drawDsWheel(side, highlightIndex = -1) {
  const { canvas, ctx, items, angle } = DS[side];
  const size   = canvas.width;
  const cx     = size / 2;
  const cy     = size / 2;
  const radius = cx - 8;

  ctx.clearRect(0, 0, size, size);

  if (items.length === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#1e1e2e';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#555';
    ctx.font = `bold 13px Sora, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Tambah item', cx, cy - 8);
    ctx.fillText('di bawah!', cx, cy + 12);
    return;
  }

  const arc = (Math.PI * 2) / items.length;

  items.forEach((item, i) => {
    const startAngle = arc * i + angle;
    const endAngle   = startAngle + arc;
    const color      = DS_COLORS[i % DS_COLORS.length];
    const isHl       = i === highlightIndex;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, isHl ? radius + 4 : radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = isHl ? lightenDsColor(color, 30) : color;
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
    const fontSize = items.length > 8 ? 10 : 12;
    ctx.font = `bold ${fontSize}px Sora, sans-serif`;
    let label = item;
    if (label.length > 12) label = label.substring(0, 10) + '…';
    ctx.fillText(label, radius - 12, 4);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fillStyle = '#0f0f1a';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(side === 'left' ? 'A' : 'B', cx, cy);
}

// ── DOUBLE SPIN ───────────────────────────────────────────────
async function doubleSpin() {
  if (dsIsSpinning) return;
  if (DS.left.items.length < 1 || DS.right.items.length < 1) {
    showToast('Pastikan ada item di kedua roda!', 'error');
    return;
  }

  // 🔥 FITUR BARU: EKSEKUSI INSTAN JIKA SISA 1 VS 1
  if (DS.left.items.length === 1 && DS.right.items.length === 1) {
    const leftText = DS.left.items[0];
    const rightText = DS.right.items[0];

    // Langsung hapus
    DS.left.items = [];
    DS.right.items = [];

    // Simpan & Render ulang
    saveDsItems('left');
    saveDsItems('right');
    renderDsItems('left');
    renderDsItems('right');

    DS.left.angle = 0;
    DS.right.angle = 0;
    drawDsWheel('left');
    drawDsWheel('right');

    // Catat ke riwayat
    dsResults.unshift({ left: leftText, right: rightText });
    renderDsResults();

    // Langsung munculkan Pop-up & Confetti
    launchDsConfetti();
    showDsResultModal(leftText, rightText);
    showToast('Sisa 1 pasang terakhir otomatis dieksekusi! ⚡', 'success');
    return;
  }

  dsIsSpinning = true;
  document.getElementById('doubleSpinBtn').disabled = true;
  document.getElementById('doubleSpinBtn').textContent = '⚡ Berputar…';

  if (window.AudioController) AudioController.playSpinSound();

  document.getElementById('connectorLine').classList.add('active');
  DS.left.canvas.classList.add('spinning-glow');
  DS.right.canvas.classList.add('spinning-glow');

  const totalLeft  = Math.PI * 2 * (5 + Math.random() * 5);
  const totalRight = Math.PI * 2 * (5 + Math.random() * 5);
  const duration   = 4000 + Math.random() * 800;

  const startAngleLeft  = DS.left.angle;
  const startAngleRight = DS.right.angle;
  const startTime = performance.now();

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 4);
  }

  function animate(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased    = easeOut(progress);

    DS.left.angle  = startAngleLeft  + totalLeft  * eased;
    DS.right.angle = startAngleRight + totalRight * eased;

    drawDsWheel('left');
    drawDsWheel('right');

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      finishDoubleSpin();
    }
  }

  requestAnimationFrame(animate);
}

function finishDoubleSpin() {
  const leftWinner = calcWinner('left');
  const rightWinner = calcWinner('right');

  const leftText = leftWinner.text;
  const rightText = rightWinner.text;

  // Hapus dari array
  DS.left.items.splice(leftWinner.index, 1);
  DS.right.items.splice(rightWinner.index, 1);

  // Simpan & Render
  saveDsItems('left');
  saveDsItems('right');
  renderDsItems('left');
  renderDsItems('right');

  DS.left.angle = 0;
  DS.right.angle = 0;
  drawDsWheel('left');
  drawDsWheel('right');

  // Catat riwayat
  dsResults.unshift({ left: leftText, right: rightText });
  renderDsResults();

  // Reset UI
  dsIsSpinning = false;
  document.getElementById('doubleSpinBtn').disabled = false;
  document.getElementById('doubleSpinBtn').textContent = '⚡ DOUBLE SPIN!';
  document.getElementById('connectorLine').classList.remove('active');
  DS.left.canvas.classList.remove('spinning-glow');
  DS.right.canvas.classList.remove('spinning-glow');

  if (window.AudioController) AudioController.stopSpinSound();

  launchDsConfetti();
  showDsResultModal(leftText, rightText);
}

function calcWinner(side) {
  const { items, angle } = DS[side];
  const arc = (Math.PI * 2) / items.length;
  const normalizedAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
  const pointerAngle    = (Math.PI * 2 - normalizedAngle) % (Math.PI * 2);
  const index           = Math.floor(pointerAngle / arc) % items.length;
  return { index, text: items[index] };
}

// ── MODAL POP-UP ──────────────────────────────────────────────
function showDsResultModal(leftText, rightText) {
  const modal = document.getElementById('dsResultModal');
  document.getElementById('modalLeftItem').textContent = leftText;
  document.getElementById('modalRightItem').textContent = rightText;
  modal.style.display = 'flex';
}

function closeDsResultModal() {
  document.getElementById('dsResultModal').style.display = 'none';
}

// ── Render hasil (Tabel Bawah) ────────────────────────────────
function renderDsResults() {
  const area = document.getElementById('dsResultsArea');
  const list = document.getElementById('dsResultsList');
  area.style.display = 'block';

  list.innerHTML = dsResults.map((pair, i) => `
    <div class="ds-result-pair" style="animation-delay:${i * 0.05}s">
      <div class="ds-result-index">${dsResults.length - i}</div>
      <div class="ds-result-left">${escapeHtml(pair.left)}</div>
      <div class="ds-result-arrow">→</div>
      <div class="ds-result-right">${escapeHtml(pair.right)}</div>
    </div>
  `).join('');
}

function clearResults() {
  dsResults = [];
  document.getElementById('dsResultsArea').style.display = 'none';
}

function resetDoubleResult() {
  clearResults();
  DS.left.angle  = 0;
  DS.right.angle = 0;
  drawDsWheel('left');
  drawDsWheel('right');
  showToast('Hasil direset!', 'info');
}

// ── Item Management ───────────────────────────────────────────
function addDsItem(side) {
  const inputId = side === 'left' ? 'leftItemInput' : 'rightItemInput';
  const input = document.getElementById(inputId);
  const text  = input.value.trim();

  if (!text) {
    showToast('Masukkan teks item dulu!', 'error');
    return;
  }
  if (DS[side].items.length >= 12) {
    showToast('Maksimal 12 item per roda!', 'error');
    return;
  }
  if (DS[side].items.includes(text)) {
    showToast('Item sudah ada!', 'error');
    return;
  }

  DS[side].items.push(text);
  input.value = '';
  input.focus();
  saveDsItems(side);
  renderDsItems(side);
  drawDsWheel(side);
}

function removeDsItem(side, index) {
  DS[side].items.splice(index, 1);
  saveDsItems(side);
  renderDsItems(side);
  drawDsWheel(side);
}

function handleDsKey(event, side) {
  if (event.key === 'Enter') addDsItem(side);
}

function renderDsItems(side) {
  const listId   = side === 'left' ? 'leftItemsList'  : 'rightItemsList';
  const countId  = side === 'left' ? 'leftCount'       : 'rightCount';
  const list     = document.getElementById(listId);
  const counter  = document.getElementById(countId);
  const items    = DS[side].items;

  counter.textContent = items.length;

  if (items.length === 0) {
    const icon = side === 'left' ? '👥' : '📋';
    const label = side === 'left' ? 'Roda A' : 'Roda B';
    list.innerHTML = `
      <div class="empty-options">
        <span class="empty-icon">${icon}</span>
        <p>Tambah item untuk ${label}</p>
      </div>`;
    return;
  }

  list.innerHTML = items.map((item, i) => `
    <div class="option-item" style="--color: ${DS_COLORS[i % DS_COLORS.length]}">
      <span class="option-dot"></span>
      <span class="option-text">${escapeHtml(item)}</span>
      <button class="option-remove" onclick="removeDsItem('${side}', ${i})" title="Hapus">✕</button>
    </div>
  `).join('');
}

function saveDsItems(side) {
  localStorage.setItem(`ds_${side}_items`, JSON.stringify(DS[side].items));
}

function loadDsPreset(side, presetKey) {
  const preset = DS_PRESETS[presetKey];
  if (!preset) return;
  DS[side].items = [...preset];
  saveDsItems(side);
  renderDsItems(side);
  drawDsWheel(side);
  showToast(`Contoh "${presetKey}" dimuat! ✓`, 'success');
}

function editTitle(side) {
  const el  = document.getElementById(side === 'left' ? 'leftTitleEditable' : 'rightTitleEditable');
  const cur = el.textContent;
  const newVal = prompt(`Ubah label Roda ${side === 'left' ? 'A' : 'B'}:`, cur);
  if (newVal && newVal.trim()) {
    el.textContent = newVal.trim();
    const hintId = side === 'left' ? 'leftWheelHint' : 'rightWheelHint';
    document.getElementById(hintId).textContent = newVal.trim();
  }
}

// ── Confetti ──────────────────────────────────────────────────
function launchDsConfetti() {
  const colors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF', '#FF9A3C'];
  for (let i = 0; i < 70; i++) {
    const dot = document.createElement('div');
    dot.className = 'confetti-dot';
    dot.style.cssText = `
      left: ${Math.random() * 100}vw;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-delay: ${Math.random() * 0.6}s;
      width: ${4 + Math.random() * 8}px;
      height: ${4 + Math.random() * 8}px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
    `;
    document.body.appendChild(dot);
    setTimeout(() => dot.remove(), 2600);
  }
}

// ── Utilities ─────────────────────────────────────────────────
function lightenDsColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

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