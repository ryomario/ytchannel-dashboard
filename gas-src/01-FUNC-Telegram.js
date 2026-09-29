// ===================================================
// KIRIM PESAN KE TELEGRAM
// ===================================================
function sendTelegram(message, chatId = null, threadId = null) {
  const targetChatId = chatId || CONFIG.TELEGRAM_CHAT_ID;
  const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/sendMessage`;
  const payload = {
    chat_id: targetChatId,
    text: message,
    parse_mode: 'Markdown',
    disable_web_page_preview: true, // Agar preview link YouTube tidak memenuhi layar
  };
  // 💡 JIKA PESAN BERASAL DARI TOPIK, SERTAKAN THREAD ID
  if (threadId && !isNaN(threadId)) {
    payload["message_thread_id"] = threadId;
  }

  const options = {
    method: "post",
    contentType: "application/json",
    muteHttpExceptions: true,
    payload: JSON.stringify(payload),
  }
  try {
    const response = UrlFetchApp.fetch(url, options);
    let responseText = '';
    try {
      responseText = response.getContentText() || '';
    } catch (contentErr) {
      responseText = '[content-unavailable]';
    }

    let parsed = null;
    try {
      parsed = responseText ? JSON.parse(responseText) : null;
    } catch (parseErr) {
      parsed = null;
    }

    logAppEvent('info', 'telegram', 'Telegram message delivery result', {
      statusCode: response.getResponseCode(),
      ok: !!(parsed && parsed.ok),
      description: parsed && parsed.description ? String(parsed.description).slice(0, 120) : 'n/a'
    });
  } catch (e) {
    logAppEvent('error', 'telegram', 'Failed to send Telegram message', { error: e.message });
  }
}