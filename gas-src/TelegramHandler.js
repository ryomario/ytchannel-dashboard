/**
 * ===================================================
 * TELEGRAM WEBHOOK & BOT COMMAND HANDLER
 * ===================================================
 */

/**
 * Memvalidasi apakah request webhook Telegram memenuhi syarat keamanan:
 * - Memeriksa kecocokan header X-Telegram-Bot-Api-Secret-Token jika TELEGRAM_SECRET_HEADER disetel.
 *
 * @param {Object} e - Event object doPost(e)
 * @returns {{ valid: boolean, error?: string }}
 */
function verifyTelegramWebhook(e) {
  const config = getConfig();
  const requiredSecret = config.TELEGRAM_SECRET_HEADER;

  // Jika properti TELEGRAM_SECRET_HEADER disetel, validasi wajib lolos
  if (requiredSecret && requiredSecret.trim() !== '') {
    const incomingSecret = (e && e.parameter && e.parameter.secret) ? e.parameter.secret : '';

    if (!incomingSecret || incomingSecret !== requiredSecret) {
      let msg = 'Telegram webhook rejected: ';
      if(!incomingSecret) msg += 'missing';
      else if(incomingSecret !== requiredSecret) msg += 'invalid';
      Logger.log(msg + ' secret token header.');
      return { valid: false, error: 'Forbidden: Invalid Telegram secret header' };
    }
  }

  return { valid: true };
}

/**
 * Menangani update pesan Telegram dan menjalankan command yang sesuai.
 *
 * @param {Object} e - Event object doPost(e)
 * @param {Object} contents - Parsed JSON dari e.postData.contents
 * @returns {Object} Hasil eksekusi
 */
function handleTelegramUpdate(e, contents) {
  // 1. Verifikasi secret header
  const auth = verifyTelegramWebhook(e);
  if (!auth.valid) {
    return { success: false, error: auth.error, statusCode: 403 };
  }

  try {
    if (!contents || !contents.message) {
      // Abaikan update non-message (seperti edited_message, inline query, dsb jika tidak dibutuhkan)
      return { success: true, ignored: true };
    }

    const message = contents.message;
    const chatId = message.chat ? message.chat.id : null;
    const fromId = message.from ? message.from.id : chatId;
    const threadId = message.message_thread_id || null;
    const rawText = (message.text || '').trim();

    if (!rawText || !rawText.startsWith('/')) {
      return { success: true, ignored: true, reason: 'Not a command' };
    }

    const parts = rawText.split(' ');
    const command = parts[0].split('@')[0].toLowerCase();
    const args = parts.slice(1).join(' ').trim();

    const config = getConfig();
    const channelId = config.YOUTUBE_CHANNEL_ID;
    let replyText = '';

    // Verifikasi whitelist admin untuk command tertentu jika diperlukan
    const isAdmin = config.TELEGRAM_ADMIN_IDS.length === 0 ||
      config.TELEGRAM_ADMIN_IDS.includes(String(chatId)) ||
      config.TELEGRAM_ADMIN_IDS.includes(String(fromId));

    switch (command) {
      case '/stats':
        replyText = (typeof msgChannelData === 'function')
          ? msgChannelData(channelId)
          : '⚠️ Fungsi /stats belum tersedia.';
        break;

      case '/latest':
        replyText = (typeof msgLatestVideos === 'function')
          ? msgLatestVideos(channelId)
          : '⚠️ Fungsi /latest belum tersedia.';
        break;

      case '/search':
        if (!args) {
          replyText = '⚠️ Gunakan format: `/search [kata kunci]`';
        } else {
          replyText = (typeof msgSearchResults === 'function')
            ? msgSearchResults(channelId, args)
            : '⚠️ Fungsi /search belum tersedia.';
        }
        break;

      case '/top':
        replyText = (typeof msgTopResults === 'function')
          ? msgTopResults(channelId)
          : '⚠️ Fungsi /top belum tersedia.';
        break;

      case '/check':
        if (!args) {
          replyText = '⚠️ Gunakan format: `/check [URL/Video ID]`';
        } else {
          replyText = (typeof msgCheckResults === 'function')
            ? msgCheckResults(channelId, args)
            : '⚠️ Fungsi /check belum tersedia.';
        }
        break;

      case '/trend':
        replyText = (typeof handleTrendCommand === 'function')
          ? handleTrendCommand()
          : '⚠️ Fungsi /trend belum tersedia.';
        break;

      // Content Planner Commands
      case '/addidea':
        replyText = (typeof handleAddIdeaCommand === 'function')
          ? handleAddIdeaCommand(args)
          : '⚠️ Fungsi /addidea belum tersedia.';
        break;

      case '/ideas':
        replyText = (typeof handleListIdeasCommand === 'function')
          ? handleListIdeasCommand()
          : '⚠️ Fungsi /ideas belum tersedia.';
        break;

      case '/done':
        replyText = (typeof handleDoneIdeaCommand === 'function')
          ? handleDoneIdeaCommand(args)
          : '⚠️ Fungsi /done belum tersedia.';
        break;

      default:
        // Command tidak dikenal, abaikan agar tidak spam
        return { success: true, unknownCommand: true };
    }

    if (replyText && chatId) {
      sendTelegram(replyText, chatId, threadId);
    }

    return { success: true };
  } catch (err) {
    Logger.log('Error handling telegram update: ' + err.toString());
    return { success: false, error: err.message };
  }
}
