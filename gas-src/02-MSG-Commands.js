// ===================================================
// COMMAND: /stats
// ===================================================
function getChannelData(channelId) {
  try {
    const data = YouTube.Channels.list(['snippet','statistics'], { id: channelId });

    if (!data.items || !data.items?.length) throw new Error('Channel tidak ditemukan');

    const channel = data.items[0];
    
    const lastState = getLastChannelState();

    saveChannelState({
      subs: channel.statistics.subscriberCount,
      views: channel.statistics.viewCount,
    });

    return {
      title: channel.snippet.title,
      subs: channel.statistics.subscriberCount,
      views: channel.statistics.viewCount,
      videos: channel.statistics.videoCount,
      newSubs: channel.statistics.subscriberCount - (lastState.subs ?? 0),
      newViews: channel.statistics.viewCount - (lastState.views ?? 0),
      lastUpdate: lastState.ts,
    };
  } catch (e) {
    Logger.log("Error ambil data Channel: " + e.message);
    throw e;
  }
}
function msgChannelData(channelId) {
  try {
    const data = getChannelData(channelId);

    return (
      `*[ YOUTUBE CHANNEL DASHBOARD ]*\n` +
      `🗓 ${getTimeString()}\n` +
      `----------------------------------------\n\n` +
      `📌 *Channel:* ${data.title}\n\n` +
      `📊 *METRIK UTAMA*\n` +
      ` • Subscribers  : *${Number(data.subs).toLocaleString('id-ID')}*\n` +
      ` • Total Views  : *${Number(data.views).toLocaleString('id-ID')}*\n` +
      ` • Total Video  : *${Number(data.videos).toLocaleString('id-ID')}*\n\n` +
      `📈 *PERKEMBANGAN DARI ${getTimeElapsed(data.lastUpdate).toUpperCase()}*\n` +
      ` • Subs Baru    : *${Number(data.newSubs).toLocaleString('id-ID')}*\n` +
      ` • Views Baru   : *${Number(data.newViews).toLocaleString('id-ID')}*\n\n` +
      `----------------------------------------\n` +
      `🟢 *Status:* Data Berhasil Diperbarui`
    );
  } catch(e) {
    return msgError(parseErrorMsg(e));
  }
}

// ===================================================
// COMMAND: /latest
// ===================================================
function getLatestVideos(channelId) {
  try {
    const channelResponse = YouTube.Channels.list('contentDetails', { id: channelId });

    if (!channelResponse.items || !channelResponse.items?.length) throw new Error('Channel tidak ditemukan');

    const uploadsPlaylistId = channelResponse.items[0].contentDetails.relatedPlaylists.uploads;

    const playlistResponse = YouTube.PlaylistItems.list("snippet", {
      playlistId: uploadsPlaylistId,
      maxResults: 3
    });

    const items = playlistResponse.items;
    if (!items || items.length === 0) throw new Error("Tidak ada video yang ditemukan di channel ini.");

    const videoIds = items.map(item => item.snippet.resourceId.videoId).join(",");
    const videosResponse = YouTube.Videos.list(["statistics","snippet"], { id: videoIds });

    const videoList = videosResponse.items.map(video => {
      return {
        title: video.snippet.title,
        videoId: video.id,
        publishedAt: video.snippet.publishedAt,
        views: video.statistics.viewCount || 0,
        likes: video.statistics.likeCount || 0,
        comments: video.statistics.commentCount || 0
      };
    });

    return videoList;
  } catch (e) {
    Logger.log("Error ambil data Video terbaru: " + e.message);
    throw e;
  }
}
function msgLatestVideos(channelId) {
  try {
    const videoList = getLatestVideos(channelId);

    let videoContent = "";

    videoList.forEach((video, index) => {
      const timeAgo = getTimeElapsed(video.publishedAt);
      const videoUrl = `https://youtu.be/${video.videoId}`;

      videoContent += 
        `🎬 *${index + 1}. ${escapeMarkdown(video.title)}*\n` +
        ` • Upload    : *${timeAgo}*\n` +
        ` • Views     : *${Number(video.views).toLocaleString('id-ID')}*\n` +
        ` • Likes     : *${Number(video.likes).toLocaleString('id-ID')}* │ Comments: *${Number(video.comments).toLocaleString('id-ID')}*\n` +
        ` • Link      : [Tonton Video](${videoUrl})\n\n`;
    });

    return (
      `*[ YOUTUBE - LATEST VIDEOS PERFORMANCE ]*\n` +
      `🗓 ${getTimeString()}\n` +
      `----------------------------------------\n\n` +
      `${videoContent}` +
      `----------------------------------------\n` +
      `🟢 *Status:* Data Video Terbaru Diperbarui`
    );
  } catch(e) {
    return msgError(parseErrorMsg(e));
  }
}

// ===================================================
// COMMAND: /search [Kata Kunci]
// ===================================================
function getSearchResults(channelId, query) {
  try {
    if (!query) throw new Error('FORMAT "query" SALAH');

    // Cari Video berdasarkan kata kunci khusus di channel sendiri
    const searchResponse = YouTube.Search.list(["id","snippet"], {
      channelId: channelId,
      q: query,
      type: "video",
      maxResults: 3
    });

    if (!searchResponse.items || searchResponse.items.length === 0) {
      return [];
    }

    // Ambil statistik lengkap untuk hasil pencarian
    const videoIds = searchResponse.items.map(item => item.id.videoId).join(",");
    const videosResponse = YouTube.Videos.list(["statistics","snippet"], { id: videoIds });

    const videoList = videosResponse.items.map(video => ({
      title: video.snippet.title,
      videoId: video.id,
      publishedAt: video.snippet.publishedAt,
      views: video.statistics.viewCount || 0,
      likes: video.statistics.likeCount || 0,
      comments: video.statistics.commentCount || 0
    }));
    
    return videoList;
  } catch (e) {
    Logger.log("Error mencari video: " + e.message);
    throw e;
  }
}
function msgSearchResults(channelId, query) {
  if (!query) {
    return (
      `⚠️ *FORMAT SALAH*\n\n` +
      `Gunakan format: \`/search [kata kunci]\`\n` +
      `Contoh: \`/search tutorial apps script\``
    );
  }

  try {
    const videoList = getSearchResults(channelId, query);

    if(!videoList || !videoList.length) {
      return (
        `*[ YOUTUBE - SEARCH RESULT ]*\n` +
        `🗓 ${getTimeString()}\n` +
        `----------------------------------------\n\n` +
        `🔍 *Kata Kunci:* \`${escapeMarkdown(query)}\`\n` +
        `❌ *Hasil:* Tidak ada video yang cocok.\n\n` +
        `----------------------------------------\n` +
        `🟡 *Status:* Pencarian Selesai`
      );
    }

    let videoContent = "";

    videoList.forEach((video, index) => {
      const timeAgo = getTimeElapsed(video.publishedAt);
      const videoUrl = `https://youtu.be/${video.videoId}`;

      videoContent += 
        `🎬 *${index + 1}. ${escapeMarkdown(video.title)}*\n` +
        ` • Upload    : *${timeAgo}*\n` +
        ` • Views     : *${Number(video.views).toLocaleString('id-ID')}*\n` +
        ` • Likes     : *${Number(video.likes).toLocaleString('id-ID')}* │ Comments: *${Number(video.comments).toLocaleString('id-ID')}*\n` +
        ` • Link      : [Tonton Video](${videoUrl})\n\n`;
    });

    return (
      `*[ YOUTUBE - SEARCH RESULT ]*\n` +
      `🗓 ${getTimeString()}\n` +
      `----------------------------------------\n\n` +
      `🔍 *Kata Kunci:* \`${escapeMarkdown(query)}\`\n\n` +
      `${videoContent}` +
      `----------------------------------------\n` +
      `🟢 *Status:* ${videoList.length} Video Ditemukan`
    );
  } catch(e) {
    return msgError(parseErrorMsg(e));
  }
}

// ===================================================
// COMMAND: /top (5 Video Paling Banyak Views)
// ===================================================
function getTopResults(channelId) {
  try {
    // Cari Top 5 Video Berdasarkan View Count
    const searchResponse = YouTube.Search.list(["id","snippet"], {
      channelId: channelId,
      order: "viewCount",
      type: "video",
      maxResults: 5
    });

    if (!searchResponse.items || searchResponse.items.length === 0) {
      return [];
    }

    // Ambil statistik lengkap untuk hasil pencarian
    const videoIds = searchResponse.items.map(item => item.id.videoId).join(",");
    const videosResponse = YouTube.Videos.list(["statistics","snippet"], { id: videoIds });

    const videoList = videosResponse.items.map(video => ({
      title: video.snippet.title,
      videoId: video.id,
      publishedAt: video.snippet.publishedAt,
      views: video.statistics.viewCount || 0,
      likes: video.statistics.likeCount || 0,
      comments: video.statistics.commentCount || 0
    }));
    
    return videoList;
  } catch (e) {
    Logger.log("Error mencari video: " + e.message);
    throw e;
  }
}
function msgTopResults(channelId) {
  try {
    const videoList = getTopResults(channelId);

    if(!videoList || !videoList.length) {
      return msgError('Tidak ada video yang ditemukan.');
    }

    let videoContent = "";

    videoList.forEach((video, index) => {
      const timeAgo = getTimeElapsed(video.publishedAt);
      const videoUrl = `https://youtu.be/${video.videoId}`;
      const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "🔹";

      videoContent += 
        `${medal} *${index + 1}. ${escapeMarkdown(video.title)}*\n` +
        ` • Upload    : *${timeAgo}*\n` +
        ` • Views     : *${Number(video.views).toLocaleString('id-ID')}*\n` +
        ` • Engagement: *${Number(video.likes).toLocaleString('id-ID')}* Likes │ *${Number(video.comments).toLocaleString('id-ID')}* Comments\n` +
        ` • Link      : [Tonton Video](${videoUrl})\n\n`;
    });

    return (
      `*[ YOUTUBE - TOP PERFORMING VIDEOS ]*\n` +
      `🗓 ${getTimeString()}\n` +
      `----------------------------------------\n\n` +
      `${videoContent}` +
      `----------------------------------------\n` +
      `🔥 *Status:* Top 5 Video Paling Populer`
    );
  } catch(e) {
    return msgError(parseErrorMsg(e));
  }
}

// ===================================================
// COMMAND: /check [URL / Video ID]
// ===================================================
function getCheckResults(channelId, input) {
  try {
    if(!input) throw new Error('FORMAT "input" SALAH');

    // Ekstrak Video ID dari URL atau string input
    const videoId = extractVideoId(input);
    if (!videoId) throw new Error('URL/Video ID tidak valid');

    // Ambil detail statistik & snippet video
    const videosResponse = YouTube.Videos.list(["statistics","snippet","contentDetails"], { id: videoId });

    if (!videosResponse.items || videosResponse.items.length === 0) throw new Error('Video tidak ditemukan di YouTube.');

    const video = videosResponse.items[0];
    return {
      title: video.snippet.title,
      channelId: video.snippet.channelId,
      channelTitle: video.snippet.channelTitle,
      publishedAt: video.snippet.publishedAt,
      views: video.statistics.viewCount || 0,
      likes: video.statistics.likeCount || 0,
      comments: video.statistics.commentCount || 0,
      videoId: video.id
    };
  } catch (e) {
    Logger.log("Error check video: " + e.message);
    throw e;
  }
}
function msgCheckResults(channelId, input) {
  if (!input) {
    return (
      `⚠️ *FORMAT SALAH*\n\n` +
      `Gunakan format: \`/check [Link Video / Video ID]\`\n` +
      `Contoh: \`/check https://youtu.be/dQw4w9WgXcQ\`\n` +
      `Atau: \`/check dQw4w9WgXcQ\``
    );
  }

  try {
    const data = getCheckResults(channelId, input);
    
    const timeAgo = getTimeElapsed(data.publishedAt);
    const videoUrl = `https://youtu.be/${data.videoId}`;
    const channelUrl = `https://www.youtube.com/channel/${data.channelId}`;

    return (
      `*[ YOUTUBE - VIDEO METRICS CHECK ]*\n` +
      `🗓 ${getTimeString()}\n` +
      `----------------------------------------\n\n` +
      `🎬 *Judul Video:*\n` +
      ` *${escapeMarkdown(data.title)}*\n\n` +
      `📌 *Channel:* [${escapeMarkdown(data.channelTitle)}](${channelUrl})\n` +
      `⏰ *Diunggah:* ${timeAgo}\n\n` +
      `📊 *METRIK KINERJA*\n` +
      ` • Total Views    : *${Number(data.views).toLocaleString('id-ID')}*\n` +
      ` • Total Likes    : *${Number(data.likes).toLocaleString('id-ID')}*\n` +
      ` • Total Comments : *${Number(data.comments).toLocaleString('id-ID')}*\n\n` +
      `🔗 *Direct Link:* [Buka Video di YouTube](${videoUrl})\n\n` +
      `----------------------------------------\n` +
      `🟢 *Status:* Analisis Video Berhasil`
    );
  } catch(e) {
    return msgError(parseErrorMsg(e));
  }
}