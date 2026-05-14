// ============================================================
// pwa-init.js - INISIALISASI PWA LENGKAP
// Daftarkan ke SEMUA halaman HTML (kecuali server-side)
// ============================================================

(function () {
  'use strict';

  // ── 1. Daftarkan Service Worker ──────────────────────────────
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          scope: '/'
        });
        console.log('[PWA] Service Worker terdaftar:', reg.scope);

        // Dengarkan update SW
        reg.addEventListener('updatefound', () => {
          const newWorker = reg.installing;
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // Ada update tersedia — tampilkan notif
              showUpdateBanner();
            }
          });
        });

        // Terima pesan dari SW
        navigator.serviceWorker.addEventListener('message', event => {
          if (event.data?.type === 'SW_UPDATED') {
            console.log('[PWA] SW diperbarui ke versi:', event.data.version);
          }
        });

      } catch (err) {
        console.error('[PWA] Gagal daftar SW:', err);
      }
    });
  }

  // ── 2. Install App Prompt ────────────────────────────────────
  let deferredPrompt = null;
  let installBannerShown = false;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;

    // Hanya tampilkan jika belum pernah dismiss
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    const installed = localStorage.getItem('pwa-installed');

    if (!dismissed && !installed && !installBannerShown) {
      installBannerShown = true;
      // Delay sedikit supaya halaman siap dulu
      setTimeout(() => showInstallBanner(), 3000);
    }
  });

  // Deteksi jika app sudah diinstall
  window.addEventListener('appinstalled', () => {
    localStorage.setItem('pwa-installed', '1');
    deferredPrompt = null;
    hideInstallBanner();
    showNetworkToast('🎉 SpinDecide berhasil diinstall!', 'success');
    console.log('[PWA] App berhasil diinstall');
  });

  // ── 3. Buat Install Banner ───────────────────────────────────
  function showInstallBanner() {
    if (document.getElementById('pwa-install-banner')) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <span style="font-size:1.5rem;">🎯</span>
        <div style="flex:1;min-width:150px;">
          <div style="font-weight:700;font-size:0.9rem;">Install SpinDecide</div>
          <div style="font-size:0.75rem;opacity:0.8;">Buka seperti aplikasi native!</div>
        </div>
        <button id="pwa-install-btn" style="
          background:linear-gradient(135deg,#6c63ff,#9b59b6);
          color:white; border:none; padding:8px 16px;
          border-radius:50px; font-weight:700; cursor:pointer;
          font-size:0.8rem; white-space:nowrap;
        ">Install App</button>
        <button id="pwa-install-close" style="
          background:transparent; border:none; color:rgba(255,255,255,0.6);
          cursor:pointer; font-size:1.2rem; padding:4px 8px;
        ">✕</button>
      </div>
    `;

    Object.assign(banner.style, {
      position: 'fixed', bottom: '0', left: '0', right: '0',
      background: 'linear-gradient(135deg, #1a1a2e, #0f0f1a)',
      borderTop: '1px solid rgba(108,99,255,0.3)',
      padding: '16px 20px',
      zIndex: '99999',
      backdropFilter: 'blur(20px)',
      animation: 'slideUpBanner 0.4s ease',
      color: 'white', fontFamily: 'inherit',
    });

    // Inject keyframe animation
    if (!document.getElementById('pwa-banner-style')) {
      const style = document.createElement('style');
      style.id = 'pwa-banner-style';
      style.textContent = `
        @keyframes slideUpBanner {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(banner);

    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('[PWA] Install outcome:', outcome);
      if (outcome === 'accepted') {
        localStorage.setItem('pwa-installed', '1');
      }
      deferredPrompt = null;
      hideInstallBanner();
    });

    document.getElementById('pwa-install-close').addEventListener('click', () => {
      localStorage.setItem('pwa-install-dismissed', Date.now().toString());
      hideInstallBanner();
    });
  }

  function hideInstallBanner() {
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.remove();
  }

  // ── 4. Update Banner ─────────────────────────────────────────
  function showUpdateBanner() {
    if (document.getElementById('pwa-update-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-update-banner';
    banner.innerHTML = `
      <span>🆕 Ada versi baru SpinDecide tersedia!</span>
      <button id="pwa-update-btn" style="
        background:#6c63ff; color:white; border:none;
        padding:6px 14px; border-radius:20px; cursor:pointer;
        font-weight:700; font-size:0.8rem; margin-left:12px;
      ">Perbarui</button>
      <button id="pwa-update-close" style="
        background:transparent; border:none; color:rgba(255,255,255,0.6);
        cursor:pointer; font-size:1rem; margin-left:8px;
      ">✕</button>
    `;

    Object.assign(banner.style, {
      position: 'fixed', top: '0', left: '0', right: '0',
      background: '#1a1a2e', borderBottom: '2px solid #6c63ff',
      padding: '12px 20px', color: 'white',
      display: 'flex', alignItems: 'center',
      zIndex: '99999', fontFamily: 'inherit',
      fontSize: '0.85rem', fontWeight: '600',
    });

    document.body.appendChild(banner);

    document.getElementById('pwa-update-btn').addEventListener('click', () => {
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
      }
      window.location.reload();
    });

    document.getElementById('pwa-update-close').addEventListener('click', () => {
      banner.remove();
    });
  }

  // ── 5. Network Status System ─────────────────────────────────
  let networkToastTimeout = null;

  function showNetworkToast(message, type = 'offline') {
    let toast = document.getElementById('pwa-network-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'pwa-network-toast';
      document.body.appendChild(toast);
    }

    const colors = {
      offline:  { bg: '#ff6b6b', text: '#fff' },
      online:   { bg: '#6bcb77', text: '#0f0f1a' },
      success:  { bg: '#6bcb77', text: '#0f0f1a' },
      warning:  { bg: '#ffd93d', text: '#0f0f1a' },
    };
    const color = colors[type] || colors.offline;

    Object.assign(toast.style, {
      position: 'fixed', top: '16px', left: '50%',
      transform: 'translateX(-50%)',
      background: color.bg, color: color.text,
      padding: '10px 20px', borderRadius: '50px',
      fontWeight: '700', fontSize: '0.85rem',
      zIndex: '999999', whiteSpace: 'nowrap',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      transition: 'opacity 0.3s', opacity: '1',
      fontFamily: 'inherit',
    });
    toast.textContent = message;

    clearTimeout(networkToastTimeout);
    networkToastTimeout = setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Indikator offline permanen di sudut
  function updateOfflineIndicator(isOnline) {
    let indicator = document.getElementById('pwa-offline-indicator');

    if (!isOnline) {
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'pwa-offline-indicator';
        indicator.innerHTML = '📡 Offline Mode';
        Object.assign(indicator.style, {
          position: 'fixed', bottom: '70px', right: '16px',
          background: 'rgba(255,107,107,0.9)',
          color: 'white', padding: '6px 12px',
          borderRadius: '20px', fontSize: '0.75rem',
          fontWeight: '700', zIndex: '9999',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
          fontFamily: 'inherit',
        });
        document.body.appendChild(indicator);
      }
    } else {
      if (indicator) indicator.remove();
    }
  }

  // Event listeners koneksi
  window.addEventListener('online', () => {
    showNetworkToast('✅ Koneksi kembali tersambung', 'online');
    updateOfflineIndicator(true);
    // Trigger reconnect event untuk multiplayer.js
    document.dispatchEvent(new CustomEvent('pwa:online'));
  });

  window.addEventListener('offline', () => {
    showNetworkToast('📡 Offline Mode aktif', 'offline');
    updateOfflineIndicator(false);
    document.dispatchEvent(new CustomEvent('pwa:offline'));
  });

  // Cek status awal
  if (!navigator.onLine) {
    updateOfflineIndicator(false);
  }

  // ── 6. Export fungsi global ──────────────────────────────────
  window.PWA = {
    isOnline: () => navigator.onLine,
    showInstallBanner,
    hideInstallBanner,
    showNetworkToast,
    triggerInstall: async () => {
      if (!deferredPrompt) {
        showNetworkToast('💡 Install lewat menu browser (⋮ → Install App)', 'warning');
        return;
      }
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      deferredPrompt = null;
      hideInstallBanner();
    },
  };

  console.log('[PWA] pwa-init.js dimuat. Online:', navigator.onLine);
})();
