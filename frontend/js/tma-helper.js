/**
 * ===================================================
 * TELEGRAM WEBAPP SDK HELPER & BROWSER FALLBACK
 * ===================================================
 * Memberikan wrapper terpadu untuk Telegram WebApp SDK
 * dengan graceful degradation penuh saat dijalankan di browser biasa (Desktop/Mobile).
 */

const TMAHelper = (() => {
  const getTg = () => (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;

  let currentBackListener = null;
  let currentMainListener = null;

  /**
   * Mengecek apakah antarmuka berjalan di dalam Telegram Mini App
   * @returns {boolean}
   */
  function isTMA() {
    const tg = getTg();
    return Boolean(tg && (tg.initData || (tg.platform && tg.platform !== 'unknown')));
  }

  /**
   * Inisialisasi dasar Telegram WebApp (viewport, tema) secara aman
   */
  function initApp() {
    const tg = getTg();
    if (tg) {
      try {
        if (typeof tg.ready === 'function') tg.ready();
        if (typeof tg.expand === 'function') tg.expand();
        if (typeof tg.setHeaderColor === 'function') tg.setHeaderColor('#0f172a');
        if (typeof tg.setBackgroundColor === 'function') tg.setBackgroundColor('#0f172a');
      } catch (err) {
        console.warn('TMAHelper.initApp warning:', err);
      }
    }
  }

  /**
   * Memicu haptic feedback jika di Telegram, atau Web Vibration API / no-op di browser biasa
   * @param {'impact'|'notification'|'selection'} type
   * @param {'light'|'medium'|'heavy'|'success'|'warning'|'error'} [style='light']
   */
  function triggerHaptic(type = 'impact', style = 'light') {
    const tg = getTg();
    if (tg && tg.HapticFeedback) {
      try {
        if (type === 'selection') {
          tg.HapticFeedback.selectionChanged();
          return;
        }
        if (type === 'notification') {
          tg.HapticFeedback.notificationOccurred(style);
          return;
        }
        tg.HapticFeedback.impactOccurred(style);
        return;
      } catch (err) {
        console.warn('Haptic feedback error:', err);
      }
    }

    // Graceful degradation untuk browser biasa (hanya jika didukung perangkat)
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        const duration = style === 'heavy' ? 30 : (style === 'medium' ? 20 : 12);
        navigator.vibrate(duration);
      }
    } catch (_) {
      // Abaikan jika tidak didukung
    }
  }

  /**
   * Menampilkan dialog konfirmasi asli Telegram atau window.confirm pada browser biasa
   * @param {string} message
   * @returns {Promise<boolean>}
   */
  function confirm(message) {
    const tg = getTg();
    if (tg && typeof tg.showConfirm === 'function') {
      return new Promise((resolve) => {
        try {
          tg.showConfirm(message, (confirmed) => {
            resolve(Boolean(confirmed));
          });
        } catch (err) {
          console.warn('tg.showConfirm failed, fallback to window.confirm:', err);
          resolve(window.confirm(message));
        }
      });
    }

    // Fallback browser biasa
    return Promise.resolve(window.confirm(message));
  }

  /**
   * Menampilkan tombol kembali native Telegram (BackButton)
   * @param {Function} onClick
   */
  function showBackButton(onClick) {
    const tg = getTg();
    if (tg && tg.BackButton) {
      try {
        if (currentBackListener) {
          tg.BackButton.offClick(currentBackListener);
        }
        currentBackListener = onClick;
        tg.BackButton.onClick(currentBackListener);
        tg.BackButton.show();
      } catch (err) {
        console.warn('BackButton error:', err);
      }
    }
  }

  /**
   * Menyembunyikan tombol kembali native Telegram
   */
  function hideBackButton() {
    const tg = getTg();
    if (tg && tg.BackButton) {
      try {
        if (currentBackListener) {
          tg.BackButton.offClick(currentBackListener);
          currentBackListener = null;
        }
        tg.BackButton.hide();
      } catch (err) {
        console.warn('BackButton hide error:', err);
      }
    }
  }

  /**
   * Menampilkan tombol utama native Telegram (MainButton)
   * @param {string} text
   * @param {Function} onClick
   */
  function showMainButton(text, onClick) {
    const tg = getTg();
    if (tg && tg.MainButton) {
      try {
        if (currentMainListener) {
          tg.MainButton.offClick(currentMainListener);
        }
        currentMainListener = onClick;
        tg.MainButton.setText(text);
        tg.MainButton.onClick(currentMainListener);
        tg.MainButton.show();
      } catch (err) {
        console.warn('MainButton error:', err);
      }
    }
  }

  /**
   * Menyembunyikan tombol utama native Telegram
   */
  function hideMainButton() {
    const tg = getTg();
    if (tg && tg.MainButton) {
      try {
        if (currentMainListener) {
          tg.MainButton.offClick(currentMainListener);
          currentMainListener = null;
        }
        tg.MainButton.hide();
      } catch (err) {
        console.warn('MainButton hide error:', err);
      }
    }
  }

  return {
    isTMA,
    initApp,
    triggerHaptic,
    confirm,
    showBackButton,
    hideBackButton,
    showMainButton,
    hideMainButton
  };
})();

// Ekspos secara global
if (typeof window !== 'undefined') {
  window.TMAHelper = TMAHelper;
}
