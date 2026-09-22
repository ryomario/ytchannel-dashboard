/**
 * ===================================================
 * CLIENT-SIDE AUTHENTICATION & SECRET MANAGEMENT
 * ===================================================
 */

const STORAGE_KEY_TOKEN = 'YT_GAS_APP_TOKEN';

/**
 * Mengambil token rahasia yang saat ini tersimpan di sessionStorage
 * @returns {string|null}
 */
function getAuthToken() {
  return sessionStorage.getItem(STORAGE_KEY_TOKEN) || null;
}

/**
 * Menyimpan token rahasia ke sessionStorage
 * @param {string} token
 */
function setAuthToken(token) {
  if (token && token.trim()) {
    sessionStorage.setItem(STORAGE_KEY_TOKEN, token.trim());
  }
}

/**
 * Menghapus token dari sessionStorage
 */
function clearAuthToken() {
  sessionStorage.removeItem(STORAGE_KEY_TOKEN);
}

/**
 * Membaca token dari URL hash (#token=...), menyimpannya ke sessionStorage,
 * dan segera membersihkan address bar browser.
 * @returns {string|null} Token yang ditemukan, atau null
 */
function extractTokenFromHash() {
  try {
    const hash = window.location.hash;
    if (hash && hash.includes('token=')) {
      const params = new URLSearchParams(hash.substring(1)); // potong '#'
      const token = params.get('token');

      if (token && token.trim()) {
        setAuthToken(token.trim());

        // Segera hapus token dari address bar tanpa me-reload halaman
        const cleanUrl = window.location.pathname + window.location.search;
        window.history.replaceState(null, document.title, cleanUrl);

        return token.trim();
      }
    }
  } catch (err) {
    console.error("Error parsing token from hash:", err);
  }
  return null;
}

/**
 * Menampilkan modal input password
 */
function showPasswordModal(errorMessage = '') {
  const modal = document.getElementById('passwordModal');
  const errorEl = document.getElementById('modalError');
  const input = document.getElementById('passwordInput');

  if (modal) {
    modal.classList.add('active');
  }
  if (errorEl) {
    if (errorMessage) {
      errorEl.textContent = errorMessage;
      errorEl.style.display = 'block';
    } else {
      errorEl.style.display = 'none';
    }
  }
  if (input) {
    input.value = '';
    setTimeout(() => input.focus(), 100);
  }
}

/**
 * Menyembunyikan modal password
 */
function hidePasswordModal() {
  const modal = document.getElementById('passwordModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

/**
 * Menampilkan layar Unauthorized (Akses Ditolak)
 */
function showUnauthorizedScreen(message = 'Token autentikasi tidak valid atau sudah kedaluwarsa.') {
  clearAuthToken();
  const screen = document.getElementById('unauthorizedScreen');
  const descEl = document.getElementById('unauthorizedDesc');

  if (descEl) {
    descEl.textContent = message;
  }
  if (screen) {
    screen.classList.add('active');
  }
  hidePasswordModal();
}

/**
 * Menyembunyikan layar Unauthorized
 */
function hideUnauthorizedScreen() {
  const screen = document.getElementById('unauthorizedScreen');
  if (screen) {
    screen.classList.remove('active');
  }
}

/**
 * Menginisialisasi token:
 * 1. Cek dari hash URL (akses TMA / direct link dengan #token=...)
 * 2. Cek dari sessionStorage (jika sudah login sebelumnya)
 * 3. Jika belum ada token, buka modal password
 *
 * @param {Function} onTokenReady - Callback yang dipanggil saat token sudah tersedia
 */
function initAuth(onTokenReady) {
  // 1. Prioritaskan URL Hash
  const tokenFromHash = extractTokenFromHash();
  if (tokenFromHash) {
    hideUnauthorizedScreen();
    hidePasswordModal();
    if (typeof onTokenReady === 'function') onTokenReady(tokenFromHash);
    return;
  }

  // 2. Cek sessionStorage
  const tokenFromStorage = getAuthToken();
  if (tokenFromStorage) {
    hideUnauthorizedScreen();
    hidePasswordModal();
    if (typeof onTokenReady === 'function') onTokenReady(tokenFromStorage);
    return;
  }

  // 3. Tampilkan modal input kata sandi
  showPasswordModal();
}

/**
 * Handler tombol submit pada modal input kata sandi
 * @param {Function} onTokenSubmitted - Callback setelah token disimpan
 */
function handlePasswordSubmit(onTokenSubmitted) {
  const input = document.getElementById('passwordInput');
  const val = input ? input.value.trim() : '';

  if (!val) {
    const errorEl = document.getElementById('modalError');
    if (errorEl) {
      errorEl.textContent = 'Silakan masukkan kata sandi rahasia.';
      errorEl.style.display = 'block';
    }
    return;
  }

  setAuthToken(val);
  hidePasswordModal();
  hideUnauthorizedScreen();

  if (typeof onTokenSubmitted === 'function') {
    onTokenSubmitted(val);
  }
}
