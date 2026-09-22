/**
 * ===================================================
 * API AUTHENTICATION & SECURITY (HMAC-SHA256)
 * ===================================================
 */

/**
 * Memvalidasi autentikasi request dari Frontend:
 * 1. Pengecekan toleransi timestamp (anti-replay, batas 60 detik)
 * 2. Pencocokan signature HMAC-SHA256 dengan APP_SHARED_SECRET
 *
 * @param {Object} body - Parsed JSON request body dari doPost(e)
 * @returns {{ authorized: boolean, error?: string }}
 */
function verifyFrontendAuth(body) {
  try {
    if (!body || typeof body !== 'object') {
      return { authorized: false, error: 'Bad Request: Invalid JSON payload' };
    }

    const timestamp = Number(body.timestamp);
    const action = body.action;
    const payload = body.payload !== undefined ? body.payload : {};
    const signature = (body.signature || '').toLowerCase().trim();

    if (!timestamp || !action || !signature) {
      return { authorized: false, error: 'Unauthorized: Missing auth parameters (timestamp, action, signature)' };
    }

    // 1. Anti-Replay Attack: Validasi toleransi waktu 60 detik (60.000 ms)
    const now = Date.now();
    const diff = Math.abs(now - timestamp);
    const MAX_TOLERANCE_MS = 60000;

    if (diff > MAX_TOLERANCE_MS) {
      Logger.log(`Auth failed: Timestamp expired. Diff: ${diff}ms, Max: ${MAX_TOLERANCE_MS}ms`);
      return { authorized: false, error: 'Unauthorized: Request timestamp expired (tolerance 60s)' };
    }

    // 2. Hitung ulang HMAC-SHA256
    const config = getConfig();
    const sharedSecret = config.APP_SHARED_SECRET;
    if (!sharedSecret) {
      Logger.log('Auth failed: APP_SHARED_SECRET is not configured in Script Properties.');
      return { authorized: false, error: 'Internal Error: Shared secret not configured' };
    }

    const payloadString = JSON.stringify(payload);
    const messageToSign = `${timestamp}:${action}:${payloadString}`;
    const expectedSignature = computeHmacSha256Hex(messageToSign, sharedSecret);

    if (expectedSignature.toLowerCase() !== signature) {
      Logger.log(`Auth failed: Signature mismatch. Expected: ${expectedSignature}, Received: ${signature}`);
      return { authorized: false, error: 'Unauthorized: Invalid signature' };
    }

    return { authorized: true };
  } catch (err) {
    Logger.log('Exception in verifyFrontendAuth: ' + err.toString());
    return { authorized: false, error: 'Unauthorized: ' + err.message };
  }
}

/**
 * Menghitung HMAC-SHA256 dan mengembalikan representasi string Hexadecimal
 * @param {string} message
 * @param {string} secret
 * @returns {string} Hex string
 */
function computeHmacSha256Hex(message, secret) {
  const byteSignature = Utilities.computeHmacSha256Signature(message, secret, Utilities.Charset.UTF_8);
  return byteSignature.map(function(byte) {
    const hex = (byte < 0 ? byte + 256 : byte).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}
