/**
 * ===================================================
 * CRYPTOGRAPHY & SIGNATURE UTILITIES
 * ===================================================
 */

/**
 * Menghasilkan tanda tangan HMAC-SHA256 dari pesan berbasis waktu:
 * Format pesan: `${timestamp}:${action}:${JSON.stringify(payload)}`
 *
 * @param {string} secretKey - Kata kunci rahasia bersama (shared secret)
 * @param {number} timestamp - Waktu Unix dalam milidetik
 * @param {string} action - Nama endpoint / aksi
 * @param {Object} payload - Parameter data request
 * @returns {string} Hexadecimal HMAC signature
 */
function generateHmacSignature(secretKey, timestamp, action, payload) {
  const payloadString = JSON.stringify(payload || {});
  const message = `${timestamp}:${action}:${payloadString}`;

  // Prioritaskan pustaka CryptoJS jika sudah dimuat
  if (typeof CryptoJS !== 'undefined' && CryptoJS.HmacSHA256) {
    const hash = CryptoJS.HmacSHA256(message, secretKey);
    return hash.toString(CryptoJS.enc.Hex).toLowerCase();
  }

  throw new Error("CryptoJS library is not available. Please ensure crypto-js is loaded.");
}
