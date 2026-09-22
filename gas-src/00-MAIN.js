/**
 * ===================================================
 * WEBHOOK RECEIVER (Menangani Perintah /latest)
 * ===================================================
 */
function doPost(e) {
  try {
    const contents = JSON.parse(e.postData.contents);
    const chatId = contents.message.chat.id;
    // 💡 TANGKAP THREAD ID (Jika pesan berasal dari Topik Grup)
    const threadId = contents.message.message_thread_id || null;
    const text = contents.message.text.trim();

    const command = text.split(' ')[0].split('@')[0];
    let messages = '';
    const channelId = CONFIG.YOUTUBE_CHANNEL_ID;

    // Format command: /stats
    if (command == "/stats") {
      messages = msgChannelData(channelId);
    } else if (command == "/latest") {
      messages = msgLatestVideos(channelId);
    } else if (command == "/search") {
      const txt_arr = text.split(' ');
      txt_arr.shift();
      const query = txt_arr.join(' ');
      messages = msgSearchResults(channelId, query);
    } else if (command == "/top") {
      messages = msgTopResults(channelId);
    } else if (command == "/check") {
      const txt_arr = text.split(' ');
      txt_arr.shift();
      const input = txt_arr.join(' ');
      messages = msgCheckResults(channelId, input);
    } else if (command == "/trend") {
      messages = handleTrendCommand();
    }
    // === INTEGRASI CONTENT PLANNER ===
    else if (command == "/addidea") {
      const txt_arr = text.split(' ');
      txt_arr.shift();
      const ideaText = txt_arr.join(' ');
      messages = handleAddIdeaCommand(ideaText);
    } else if (command == "/ideas") {
      messages = handleListIdeasCommand();
    } else if (command == "/done") {
      const txt_arr = text.split(' ');
      txt_arr.shift();
      const ideaId = txt_arr.join(' ');
      messages = handleDoneIdeaCommand(ideaId);
    }
    return sendTelegram(messages, chatId, threadId);
  } catch (e) {
    Logger.log("Error ambil request: " + e.message);
  }
}

/**
 * Web App Entry Point
 * Renders Index.html allowing iframe display inside Telegram WebApp
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('YouTube Channel Observer')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function testing() {
  const messages = msgCheckResults(CONFIG.YOUTUBE_CHANNEL_ID, 'https://www.youtube.com/watch?v=L7crKdQiHow');
  return sendTelegram(messages, CONFIG.TELEGRAM_GROUP_CHAT_ID, CONFIG.TELEGRAM_GROUP_CHAT_TOPICS.NOTIF);
}