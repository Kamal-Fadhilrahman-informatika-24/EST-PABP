// ============================================================
// spin.js - LOGIKA SPIN WHEEL DENGAN TOGGLE MODE & HAPUS PEMENANG
// ============================================================

let options = [];       
let isSpinning = false; 
let currentAngle = 0;   
let spinMode = 'normal'; 
let lastWinnerIndex = -1; // MEMORI UNTUK MENGINGAT SIAPA YANG BARU MENANG

const COLORS = [
  '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF',
  '#FF9A3C', '#C77DFF', '#00C9A7', '#F72585'
];

// ── Fungsi Mengubah Mode (Normal <-> Bobot) ──────────────────
function setMode(mode) {
  spinMode = mode;
  
  const btnNormal = document.getElementById('btnModeNormal');
  const btnBobot = document.getElementById('btnModeBobot');
  const weightInput = document.getElementById('weightInput');

  if (mode === 'normal') {
    btnNormal.style.borderColor = 'var(--accent-4)';
    btnNormal.style.background = 'rgba(77, 150, 255, 0.1)';
    btnNormal.style.color = 'var(--text-primary)';
    
    btnBobot.style.borderColor = 'var(--border)';
    btnBobot.style.background = 'var(--bg-card)';
    btnBobot.style.color = 'var(--text-secondary)';
    
    weightInput.style.display = 'none'; 
  } else {
    btnBobot.style.borderColor = 'var(--accent-4)';
    btnBobot.style.background = 'rgba(77, 150, 255, 0.1)';
    btnBobot.style.color = 'var(--text-primary)';
    
    btnNormal.style.borderColor = 'var(--border)';
    btnNormal.style.background = 'var(--bg-card)';
    btnNormal.style.color = 'var(--text-secondary)';
    
    weightInput.style.display = 'inline-block'; 
  }

  renderOptions();
  drawWheel();
}

// ── Tambah pilihan ke daftar ─────────────────────────────────
function addOption() {
  const textInput = document.getElementById('optionInput');
  const weightInput = document.getElementById('weightInput');
  
  const text = textInput.value.trim();
  let weight = 1;

  if (spinMode === 'bobot') {
    weight = parseInt(weightInput.value);
    if (isNaN(weight) || weight < 1) weight = 1;
  }

  if (!text) {
    showToast('Masukkan teks pilihan dulu!', 'error');
    return;
  }
  if (options.length >= 12) {
    showToast('Maksimal 12 pilihan!', 'error');
    return;
  }
  if (options.some(opt => opt.text.toLowerCase() === text.toLowerCase())) {
    showToast('Pilihan sudah ada!', 'error');
    return;
  }

  options.push({ text: text, weight: weight });
  
  textInput.value = '';
  weightInput.value = '1';
  textInput.focus();
  
  renderOptions();
  drawWheel();
}

// ── Hapus pilihan ────────────────────────────────────────────
function removeOption(index) {
  options.splice(index, 1);
  renderOptions();
  drawWheel();
}

// ── Tampilkan daftar pilihan di sidebar ──────────────────────
function renderOptions() {
  const list = document.getElementById('optionsList');
  const counter = document.getElementById('optionCount');

  counter.textContent = options.length;

  if (options.length === 0) {
    list.innerHTML = `
      <div class="empty-options">
        <span class="empty-icon">🎯</span>
        <p>Belum ada pilihan.<br>Tambahkan di atas!</p>
      </div>`;
    return;
  }

  list.innerHTML = options.map((opt, i) => {
    const weightLabel = spinMode === 'bobot' 
      ? `<small style="color: var(--accent-4); font-weight:bold; margin-left:5px;">(Bobot: ${opt.weight})</small>`
      : '';

    return `
      <div class="option-item" style="--color: ${COLORS[i % COLORS.length]}">
        <span class="option-dot"></span>
        <span class="option-text">${escapeHtml(opt.text)} ${weightLabel}</span>
        <button class="option-remove" onclick="removeOption(${i})" title="Hapus">✕</button>
      </div>
    `;
  }).join('');
}

// ── Gambar roda di canvas ─────────────────────────────────────
function drawWheel(highlightIndex = -1) {
  const canvas = document.getElementById('wheelCanvas');
  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const cx = size / 2;
  const cy = size / 2;
  const radius = cx - 10;

  ctx.clearRect(0, 0, size, size);

  if (options.length === 0) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#1e1e2e';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = '#555';
    ctx.font = 'bold 16px Sora, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Tambahkan pilihan', cx, cy - 10);
    ctx.fillText('untuk memulai!', cx, cy + 15);
    return;
  }

  const totalWeight = spinMode === 'bobot' 
    ? options.reduce((sum, opt) => sum + opt.weight, 0)
    : options.length;

  let currentSliceAngle = currentAngle;

  options.forEach((opt, i) => {
    const sliceWeight = spinMode === 'bobot' ? opt.weight : 1;
    const sliceArc = (sliceWeight / totalWeight) * Math.PI * 2;
    const startAngle = currentSliceAngle;
    const endAngle = startAngle + sliceArc;
    
    currentSliceAngle += sliceArc; 

    const color = COLORS[i % COLORS.length];
    const isHighlighted = i === highlightIndex;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, isHighlighted ? radius + 5 : radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = isHighlighted ? lightenColor(color, 30) : color;
    ctx.fill();
    ctx.strokeStyle = '#0f0f1a';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(startAngle + sliceArc / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 3;
    
    const fontSize = options.length > 8 ? 11 : 13;
    ctx.font = `bold ${fontSize}px Sora, sans-serif`;
    
    let label = opt.text;
    if (label.length > 14) label = label.substring(0, 12) + '…';
    
    if (spinMode === 'bobot') {
      const percentage = Math.round((sliceWeight / totalWeight) * 100);
      ctx.fillText(label, radius - 15, -4);
      ctx.font = `bold 10px Sora, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillText(`${percentage}%`, radius - 15, 10);
    } else {
      ctx.fillText(label, radius - 15, 5);
    }
    
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fillStyle = '#0f0f1a';
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 3;
  ctx.stroke();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🎯', cx, cy);
}

// ── SPIN! ─────────────────────────────────────────────────────
async function spinWheel() {
  if (isSpinning) return;
  if (options.length < 2) {
    showToast('Tambahkan minimal 2 pilihan!', 'error');
    return;
  }

  isSpinning = true;
  document.getElementById('spinBtn').disabled = true;
  document.getElementById('spinBtn').textContent = '🌀 Berputar...';

  if (window.AudioController) AudioController.playSpinSound();

  const totalRotation = (Math.PI * 2 * (5 + Math.random() * 5)); 
  const duration = 4000 + Math.random() * 1000;
  const startAngle = currentAngle;
  const startTime = performance.now();

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 4); 
  }

  function animate(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOut(progress);

    currentAngle = startAngle + totalRotation * eased;
    drawWheel();

    if (progress < 1) {
      requestAnimationFrame(animate);
    } else {
      const normalizedAngle = ((currentAngle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
      const pointerAngle = (Math.PI * 2 - normalizedAngle) % (Math.PI * 2);

      const totalWeight = spinMode === 'bobot' 
        ? options.reduce((sum, opt) => sum + opt.weight, 0)
        : options.length;
        
      let angleAccumulator = 0;
      let winnerIndex = 0;

      for (let i = 0; i < options.length; i++) {
        const sliceWeight = spinMode === 'bobot' ? options[i].weight : 1;
        const sliceArc = (sliceWeight / totalWeight) * Math.PI * 2;
        if (pointerAngle >= angleAccumulator && pointerAngle < angleAccumulator + sliceArc) {
          winnerIndex = i;
          break;
        }
        angleAccumulator += sliceArc;
      }

      // SIMPAN INDEX PEMENANG KE MEMORI
      lastWinnerIndex = winnerIndex;
      const winner = options[winnerIndex].text;

      drawWheel(winnerIndex); 
      
      if (window.AudioController) AudioController.stopSpinSound();
      showResult(winner);
      saveSpinResult(winner);

      isSpinning = false;
      document.getElementById('spinBtn').disabled = false;
      document.getElementById('spinBtn').textContent = '🎰 PUTAR!';
    }
  }

  requestAnimationFrame(animate);
}

// ── Tampilkan hasil ───────────────────────────────────────────
function showResult(winner) {
  const overlay = document.getElementById('resultOverlay');
  const resultText = document.getElementById('resultText');

  resultText.textContent = winner;
  overlay.classList.add('visible');

  launchConfetti();
}

function closeResult() {
  document.getElementById('resultOverlay').classList.remove('visible');
}

// ── HAPUS PEMENANG LALU TUTUP (FITUR BARU) ───────────────────
function removeWinnerAndClose() {
  if (lastWinnerIndex > -1 && lastWinnerIndex < options.length) {
    const removedOption = options.splice(lastWinnerIndex, 1)[0];
    
    // Perbarui Tampilan
    renderOptions();
    drawWheel();
    
    showToast(`"${removedOption.text}" dihapus dari roda!`, 'success');
  }
  closeResult(); // Tutup pop-up
}

// ── Simpan hasil ke Supabase ──────────────────────────────────
async function saveSpinResult(result) {
  try {
    const user = await getCurrentUser();
    if (!user) return;

    const plainOptions = options.map(opt => opt.text);

    const { error } = await supabaseClient
      .from('spins')
      .insert({
        user_id: user.id,
        options: plainOptions,       
        result: result,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Gagal menyimpan:', error.message);
    } else {
      showToast('Hasil tersimpan! ✓', 'success');
    }
  } catch (err) {
    console.error('Error saat menyimpan:', err);
  }
}

// ── Input Enter key ───────────────────────────────────────────
function handleInputKey(e) {
  if (e.key === 'Enter') addOption();
}

// ── Confetti sederhana ────────────────────────────────────────
function launchConfetti() {
  const colors = ['#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#C77DFF'];
  const container = document.body;

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
    container.appendChild(dot);
    setTimeout(() => dot.remove(), 2500);
  }
}

// ── Utility ───────────────────────────────────────────────────
function escapeHtml(text) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(text));
  return div.innerHTML;
}

function lightenColor(hex, amount) {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast toast-${type} visible`;
  setTimeout(() => toast.classList.remove('visible'), 3000);
}

function resizeCanvas() {
  const canvas = document.getElementById('wheelCanvas');
  const container = document.getElementById('wheelContainer');
  if (!canvas || !container) return;

  const size = Math.min(container.offsetWidth, container.offsetHeight, 420);
  canvas.width = size;
  canvas.height = size;
  drawWheel();
}