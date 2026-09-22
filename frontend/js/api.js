/**
 * ===================================================
 * API CLIENT WITH DYNAMIC HMAC-SHA256 SIGNING
 * ===================================================
 */

/**
 * Memanggil API backend Google Apps Script dengan tanda tangan digital dinamis.
 * Menggunakan method POST dengan Content-Type text/plain untuk menghindari CORS preflight OPTIONS.
 *
 * @param {string} action - Nama endpoint / aksi (contoh: 'getDashboardData', 'addNewIdea')
 * @param {Object} [payload={}] - Data request yang dikirim
 * @returns {Promise<Object>} Respon JSON dari GAS
 */
async function callApi(action, payload = {}) {
  const token = getAuthToken();

  if (!token) {
    showPasswordModal("Sesi belum diautentikasi. Silakan masukkan kata kunci.");
    throw new Error("Missing auth token in sessionStorage");
  }

  const timestamp = Date.now();
  let signature;

  try {
    signature = generateHmacSignature(token, timestamp, action, payload);
  } catch (err) {
    console.error("Signature generation error:", err);
    throw err;
  }

  const requestBody = {
    timestamp: timestamp,
    action: action,
    payload: payload,
    signature: signature
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), APP_CONFIG.REQUEST_TIMEOUT_MS || 30000);

  try {
    const response = await fetch(APP_CONFIG.GAS_WEBAPP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify(requestBody),
      redirect: 'follow',
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    // Deteksi jika server mengembalikan error 401 Unauthorized
    if (response.status === 401 || (data && data.unauthorized)) {
      const errorMsg = data.error || "Akses Ditolak: Kunci rahasia tidak valid atau kedaluwarsa.";
      showUnauthorizedScreen(errorMsg);
      throw new Error(errorMsg);
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new Error("Koneksi timeout: Server Apps Script tidak merespons dalam 30 detik.");
    }

    console.error(`API Error [${action}]:`, error);
    throw error;
  }
}
