/**
 * ===================================================
 * CONTENT PLANNER - NOTIFICATIONS
 * Catatan: Operasi CRUD untuk ide konten telah dipindahkan sepenuhnya ke Mini App.
 * Modul ini menangani pengiriman notifikasi ide ke Telegram.
 * ===================================================
 */

/**
 * Mengirim notifikasi penambahan atau penyelesaian ide ke topik Telegram
 *
 * @param {string|number} id - ID ide
 * @param {string} ideaText - Teks ide
 * @param {string} state - Status ide ("PLANNED", "DONE", dsb.)
 */
function notifIdea(id, ideaText, state) {
  try {
    let header = `💡 *[ BARU DITAMBAHKAN ]*\n`;
    if (state == 'DONE') header = `🎉 *[ BARU DISELESAIKAN ]*\n`;
    sendTelegram((
      header +
      `🗓 ${getTimeString()}\n` +
      `----------------------------------------\n\n` +
      `💡 *Ide Konten (ID: #${id}):*\n` +
      `"${escapeMarkdown(ideaText)}"\n\n` +
      `----------------------------------------\n` +
      `🟢 *Status:* Tersimpan di Backlog (${state})`
    ), CONFIG.TELEGRAM_GROUP_CHAT_ID, CONFIG.TELEGRAM_GROUP_CHAT_TOPICS.IDEAS);
  } catch (e) {
    Logger.log(`Error kirim notif Idea: ${id} - ${ideaText} (${state})`);
  }
}