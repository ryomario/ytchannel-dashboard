// ===================================================
// KIRIM PESAN KE TELEGRAM
// ===================================================
function sendTelegram(message, chatId = CONFIG.TELEGRAM_CHAT_ID, threadId = null) {
  const url = `https://api.telegram.org/bot${CONFIG.TELEGRAM_TOKEN}/sendMessage`;
  const payload = {
    chat_id: chatId,
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
    Logger.log("Telegram response: " + response.getContentText());
  } catch (e) {
    Logger.log("Error kirim Telegram: " + e.message);
  }
}