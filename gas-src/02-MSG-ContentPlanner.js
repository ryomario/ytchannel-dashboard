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
    const normalizedState = String(state || 'PLANNED');
    const type = normalizedState === 'DONE' ? 'success' : 'info';
    const title = normalizedState === 'DONE' ? 'Idea Completed' : 'New Idea Added';
    const summary = '💡 *Ide Konten (ID: #' + String(id) + '):*';
    const body = [
      summary,
      '"' + escapeMarkdown(String(ideaText || '')) + '"',
      '',
      '🟢 *Status:* Tersimpan di Backlog (' + normalizedState + ')'
    ];

    sendTelegram(buildTelegramMessage({
      type: type,
      title: title,
      summary: summary,
      lines: body.slice(1),
      footer: '🟢 *Status:* Tersimpan di Backlog (' + normalizedState + ')'
    }), CONFIG.TELEGRAM_GROUP_CHAT_ID, CONFIG.TELEGRAM_GROUP_CHAT_TOPICS.IDEAS);
  } catch (e) {
    logAppEvent('error', 'telegram', 'Failed to send idea notification', {
      ideaId: id,
      state: state,
      error: e.message
    });
  }
}