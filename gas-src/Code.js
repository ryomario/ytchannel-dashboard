/**
 * ===================================================
 * GOOGLE APPS SCRIPT WEB APP & DISPATCHER ENTRY POINT
 * ===================================================
 */

/**
 * Single Entry Point untuk semua request POST (Telegram Webhook & FE API)
 *
 * @param {Object} e - Event parameter dari Apps Script
 * @returns {TextOutput} JSON response
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return createJsonResponse({ success: false, error: "Bad Request: Empty post body" }, 400);
    }

    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      Logger.log("JSON parse error: " + parseErr.message);
      return createJsonResponse({ success: false, error: "Bad Request: Malformed JSON" }, 400);
    }

    // 1. Jalur Telegram Webhook
    // Terdeteksi jika memiliki 'update_id'
    const isTelegramWebhook = body && typeof body.update_id !== 'undefined';

    if (isTelegramWebhook) {
      const result = handleTelegramUpdate(e, body);
      return HtmlService.createHtmlOutput(JSON.stringify(result));
    }

    // 2. Jalur Front-End API Request
    // Terdeteksi jika memiliki properti 'action'
    if (body && typeof body.action === 'string') {
      const auth = verifyFrontendAuth(body);
      if (!auth.authorized) {
        return createJsonResponse({
          success: false,
          error: auth.error,
          unauthorized: true
        }, 401);
      }

      const actionResult = handleFrontendAction(body);
      return createJsonResponse(actionResult, 200);
    }

    // 3. Request tidak dikenali
    return createJsonResponse({
      success: false,
      error: "Bad Request: Unrecognized request format"
    }, 400);

  } catch (err) {
    Logger.log("Unhandled error in doPost: " + err.toString());
    return createJsonResponse({
      success: false,
      error: "Internal Server Error: " + err.message
    }, 500);
  }
}

/**
 * Entry Point GET: Status health-check endpoint
 */
function doGet(e) {
  return createJsonResponse({
    status: "ok",
    message: "YouTube GAS Bot API Server is online",
    timestamp: new Date().toISOString()
  }, 200);
}

/**
 * Helper untuk membungkus response JSON
 */
function createJsonResponse(data, statusCode) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
