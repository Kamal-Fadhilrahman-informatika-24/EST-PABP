// ============================================================
// offline-guard.js - GUARD KHUSUS FITUR ONLINE-ONLY
// Pasang di halaman: multiplayer.html
// ============================================================

(function () {
  'use strict';

  // ── Cek apakah halaman ini butuh internet ───────────────────
  const ONLINE_ONLY_PAGES = ['multiplayer.html', 'multiplayer'];

  function isOnlineOnlyPage() {
    const path = window.location.pathname;
    return ONLINE_ONLY_PAGES.some(p => path.includes(p));
  }

  // ── Tampilkan overlay offline ────────────────────────────────
  function showOfflineOverlay() {
    if (document.getElementById('offline-guard-overlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'offline-guard-overlay';
    overlay.innerHTML = `
      <div class="og-backdrop"></div>
      <div class="og-modal">
        <div class="og-icon">📡</div>
        <h2 class="og-title">Tidak Ada Koneksi Internet</h2>
        <p class="og-desc">
          Fitur <strong>Main Bareng</strong> membutuhkan koneksi internet
          karena menggunakan realtime server dan sinkronisasi Supabase.
        </p>
        <div class="og-features">
          <div class="og-feature offline">❌ Realtime Socket.IO</div>
          <div class="og-feature offline">❌ Sinkronisasi Supabase</div>
          <div class="og-feature offline">❌ Room multiplayer</div>
        </div>
        <div class="og-actions">
          <button class="og-btn-retry" onclick="offlineGuardRetry()">🔄 Coba Lagi</button>
          <a href="dashboard.html" class="og-btn-back">🎰 Ke Dashboard</a>
        </div>
        <p class="og-auto" id="og-auto-text">Memeriksa koneksi otomatis dalam <span id="og-timer">15</span>s…</p>
      </div>
    `;

    // Inject styles
    const style = document.createElement('style');
    style.id = 'og-styles';
    style.textContent = `
      #offline-guard-overlay {
        position: fixed; inset: 0; z-index: 999999;
        display: flex; align-items: center; justify-content: center;
        padding: 20px; font-family: inherit;
        animation: ogFadeIn 0.3s ease;
      }
      @keyframes ogFadeIn { from { opacity:0 } to { opacity:1 } }
      .og-backdrop {
        position: absolute; inset: 0;
        background: rgba(10,10,20,0.92);
        backdrop-filter: blur(12px);
      }
      .og-modal {
        position: relative; z-index: 1;
        background: linear-gradient(135deg, #1a1a2e, #16213e);
        border: 1px solid rgba(108,99,255,0.25);
        border-radius: 24px; padding: 40px 32px;
        max-width: 440px; width: 100%;
        text-align: center; color: #e8e8f0;
        box-shadow: 0 24px 60px rgba(0,0,0,0.6);
        animation: ogSlideUp 0.4s ease;
      }
      @keyframes ogSlideUp {
        from { transform: translateY(30px); opacity:0 }
        to   { transform: translateY(0);    opacity:1 }
      }
      .og-icon { font-size: 64px; margin-bottom: 16px; animation: ogPulse 2s ease infinite; }
      @keyframes ogPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(0.88);opacity:.7} }
      .og-title {
        font-size: 1.5rem; font-weight: 800; margin-bottom: 12px;
        background: linear-gradient(135deg,#fff,#6c63ff);
        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        background-clip: text;
      }
      .og-desc {
        color: #888899; font-size: 0.9rem; line-height: 1.6;
        margin-bottom: 20px;
      }
      .og-desc strong { color: #ff6b6b; -webkit-text-fill-color: #ff6b6b; }
      .og-features {
        background: rgba(255,107,107,0.07);
        border: 1px solid rgba(255,107,107,0.15);
        border-radius: 12px; padding: 14px; margin-bottom: 24px;
        display: flex; flex-direction: column; gap: 6px;
      }
      .og-feature {
        font-size: 0.82rem; text-align: left; padding: 2px 0;
      }
      .og-feature.offline { color: #ff8888; }
      .og-actions { display: flex; flex-direction: column; gap: 10px; }
      .og-btn-retry {
        padding: 13px 28px; border-radius: 50px;
        background: linear-gradient(135deg,#6c63ff,#9b59b6);
        color: white; border: none; font-size: 1rem;
        font-weight: 700; cursor: pointer;
        transition: transform .2s, box-shadow .2s;
        font-family: inherit;
      }
      .og-btn-retry:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(108,99,255,.4); }
      .og-btn-back {
        padding: 11px 28px; border-radius: 50px;
        border: 1px solid rgba(255,255,255,.1); color: #888899;
        text-decoration: none; font-size: 0.9rem; font-weight: 600;
        transition: all .2s; display: block;
      }
      .og-btn-back:hover { border-color: #6c63ff; color: #6c63ff; }
      .og-auto { font-size: 0.75rem; color: #555577; margin-top: 16px; }
      .og-auto span { color: #6c63ff; font-weight: 700; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(overlay);

    // Auto countdown
    let t = 15;
    const timerEl = document.getElementById('og-timer');
    window._ogInterval = setInterval(() => {
      t--;
      if (timerEl) timerEl.textContent = t;
      if (t <= 0) {
        offlineGuardRetry();
        t = 15;
      }
    }, 1000);
  }

  function hideOfflineOverlay() {
    clearInterval(window._ogInterval);
    const overlay = document.getElementById('offline-guard-overlay');
    const style = document.getElementById('og-styles');
    if (overlay) overlay.remove();
    if (style) style.remove();
  }

  // ── Public: retry ────────────────────────────────────────────
  window.offlineGuardRetry = function () {
    if (navigator.onLine) {
      hideOfflineOverlay();
      // Reinit multiplayer jika ada
      if (typeof initMultiplayer === 'function') {
        // Beri tanda bahwa koneksi kembali
        document.dispatchEvent(new CustomEvent('pwa:online'));
      }
      if (window.PWA) window.PWA.showNetworkToast('✅ Koneksi tersambung!', 'online');
    } else {
      if (window.PWA) window.PWA.showNetworkToast('❌ Masih offline…', 'offline');
    }
  };

  // ── Logic utama ───────────────────────────────────────────────
  function checkAndGuard() {
    if (!isOnlineOnlyPage()) return;

    if (!navigator.onLine) {
      showOfflineOverlay();
    }

    window.addEventListener('offline', () => {
      if (isOnlineOnlyPage()) showOfflineOverlay();
    });

    window.addEventListener('online', () => {
      hideOfflineOverlay();
      if (window.PWA) window.PWA.showNetworkToast('✅ Koneksi kembali — Main Bareng siap!', 'online');
    });
  }

  // Jalankan saat DOM siap
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndGuard);
  } else {
    checkAndGuard();
  }
})();
