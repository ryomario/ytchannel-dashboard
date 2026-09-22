/**
 * ===================================================
 * FRONTEND API ENDPOINTS ROUTER & HANDLERS
 * ===================================================
 */

/**
 * Main dispatcher untuk aksi-aksi dari Frontend
 *
 * @param {Object} body - { action, payload, timestamp, signature }
 * @returns {Object} JSON response
 */
function handleFrontendAction(body) {
  const action = body.action;
  const payload = body.payload || {};

  switch (action) {
    case 'getDashboardData':
      return handleGetDashboardData();

    case 'addNewIdea':
      return handleAddNewIdea(payload.text);

    case 'markIdeaDone':
      return handleMarkIdeaDone(payload.ideaId);

    case 'searchVideos':
      return handleSearchVideos(payload.query);

    default:
      return {
        success: false,
        error: `Unknown action '${action}'`
      };
  }
}

/**
 * Action: getDashboardData
 * Mengambil metrik channel, video terbaru, video terpopuler, daftar ide, dan data analitik pertumbuhan.
 */
function handleGetDashboardData() {
  try {
    const config = getConfig();
    const channelId = config.YOUTUBE_CHANNEL_ID;
    let channelStats = null;
    let latestVideos = [];
    let topVideos = [];

    // Cek apakah YouTube Advanced Service aktif
    if (typeof YouTube !== 'undefined' && YouTube.Channels) {
      channelStats = fetchChannelStats(channelId);
      if (channelStats && channelStats.id) {
        latestVideos = fetchLatestVideos(channelStats.id, 5);
        topVideos = fetchTopVideos(channelStats.id, 5);
      }
    } else {
      Logger.log("YouTube Advanced Service not active. Returning fallback metrics.");
      channelStats = getFallbackChannelStats();
      latestVideos = getFallbackLatestVideos();
      topVideos = getFallbackTopVideos();
    }

    const ideas = getIdeasStorage();
    const activeChannel = channelStats || getFallbackChannelStats();
    const growthData = getGrowthAnalyticsData(activeChannel.subscriberCount, activeChannel.viewCount);

    return {
      success: true,
      channel: activeChannel,
      latestVideos: latestVideos.length > 0 ? latestVideos : getFallbackLatestVideos(),
      topVideos: topVideos.length > 0 ? topVideos : getFallbackTopVideos(),
      ideas: ideas,
      growthData: growthData
    };
  } catch (err) {
    Logger.log("Error in handleGetDashboardData: " + err.toString());
    const fallbackChannel = getFallbackChannelStats();
    return {
      success: false,
      error: err.toString(),
      channel: fallbackChannel,
      latestVideos: getFallbackLatestVideos(),
      topVideos: getFallbackTopVideos(),
      ideas: getIdeasStorage(),
      growthData: getFallbackGrowthData(fallbackChannel.subscriberCount, fallbackChannel.viewCount)
    };
  }
}

/**
 * Action: addNewIdea
 * Menyimpan ide baru ke Spreadsheet atau Script Properties fallback
 */
function handleAddNewIdea(text) {
  try {
    if (!text || !text.trim()) {
      return { success: false, error: "Idea text cannot be empty." };
    }
    const cleanText = text.trim();
    const config = getConfig();
    const spreadsheetId = config.SPREADSHEET_ID;

    if (spreadsheetId) {
      const sheetName = config.IDEAS_SHEET_NAME || 'Ideas';
      const ss = SpreadsheetApp.openById(spreadsheetId);
      let sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(["ID", "Text Ide", "Status", "Tanggal Dibuat"]);
      }

      const lastRow = sheet.getLastRow();
      const newId = lastRow; // ID bertambah berdasarkan baris
      const createdAt = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy HH:mm");

      sheet.appendRow([newId, cleanText, "PLANNED", createdAt]);

      // Kirim notifikasi Telegram jika tersedia
      if (typeof notifIdea === 'function') {
        try {
          notifIdea(newId, cleanText, "PLANNED", createdAt);
        } catch (e) {
          Logger.log("notifIdea warning: " + e.toString());
        }
      }
    } else {
      addNewIdeaToProps(cleanText);
    }

    return {
      success: true,
      ideas: getIdeasStorage()
    };
  } catch (err) {
    Logger.log("Error in handleAddNewIdea: " + err.toString());
    return {
      success: false,
      error: err.toString(),
      ideas: getIdeasStorage()
    };
  }
}

/**
 * Action: markIdeaDone
 * Mengubah status ide antara PLANNED dan DONE
 */
function handleMarkIdeaDone(ideaId) {
  try {
    const config = getConfig();
    const spreadsheetId = config.SPREADSHEET_ID;

    if (spreadsheetId) {
      const sheetName = config.IDEAS_SHEET_NAME || 'Ideas';
      const ss = SpreadsheetApp.openById(spreadsheetId);
      const sheet = ss.getSheetByName(sheetName);

      if (sheet && sheet.getLastRow() > 1) {
        const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
        let foundRow = -1;
        let ideaText = "";
        let currentStatus = "";

        for (let i = 0; i < data.length; i++) {
          if (data[i][0] == ideaId || String(data[i][0]) === String(ideaId)) {
            foundRow = i + 2;
            ideaText = data[i][1];
            currentStatus = data[i][2];
            break;
          }
        }

        if (foundRow !== -1) {
          const newStatus = (currentStatus === "DONE") ? "PLANNED" : "DONE";
          sheet.getRange(foundRow, 3).setValue(newStatus);

          if (typeof notifIdea === 'function') {
            try {
              notifIdea(ideaId, ideaText, newStatus);
            } catch (e) {
              Logger.log("notifIdea warning: " + e.toString());
            }
          }
        }
      }
    } else {
      markIdeaDoneInProps(ideaId);
    }

    return {
      success: true,
      ideas: getIdeasStorage()
    };
  } catch (err) {
    Logger.log("Error in handleMarkIdeaDone: " + err.toString());
    return {
      success: false,
      error: err.toString(),
      ideas: getIdeasStorage()
    };
  }
}

/**
 * Action: searchVideos
 * Mencari video berdasarkan query
 */
function handleSearchVideos(query) {
  try {
    if (!query || !query.trim()) {
      return { success: true, videos: [] };
    }

    const config = getConfig();
    const channelId = config.YOUTUBE_CHANNEL_ID;
    let searchResults = [];

    if (typeof YouTube !== 'undefined' && YouTube.Search) {
      const searchOptions = {
        maxResults: 10,
        type: 'video',
        q: query.trim()
      };
      if (channelId) {
        searchOptions.channelId = channelId;
      }

      const response = YouTube.Search.list('snippet', searchOptions);
      if (response && response.items && response.items.length > 0) {
        const videoIds = response.items.map(item => item.id.videoId).join(',');
        const videoStatsResponse = YouTube.Videos.list('snippet,statistics', { id: videoIds });

        if (videoStatsResponse && videoStatsResponse.items) {
          searchResults = videoStatsResponse.items.map(formatVideoItem);
        }
      }
    } else {
      const fallbackList = getFallbackLatestVideos();
      searchResults = fallbackList.filter(v =>
        v.title.toLowerCase().includes(query.toLowerCase())
      );
    }

    return {
      success: true,
      query: query,
      videos: searchResults
    };
  } catch (err) {
    Logger.log("Error in handleSearchVideos: " + err.toString());
    return {
      success: false,
      error: err.toString(),
      videos: []
    };
  }
}

// ==========================================
// YOUTUBE DATA API HELPERS
// ==========================================

function fetchChannelStats(channelId) {
  const params = { snippet: true, statistics: true };
  if (channelId) {
    params.id = channelId;
  } else {
    params.mine = true;
  }

  const response = YouTube.Channels.list('snippet,statistics', params);
  if (response && response.items && response.items.length > 0) {
    const item = response.items[0];
    return {
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      customUrl: item.snippet.customUrl || '',
      avatarUrl: item.snippet.thumbnails.default.url,
      subscriberCount: parseInt(item.statistics.subscriberCount || 0, 10),
      viewCount: parseInt(item.statistics.viewCount || 0, 10),
      videoCount: parseInt(item.statistics.videoCount || 0, 10)
    };
  }
  return null;
}

function fetchLatestVideos(channelId, limit) {
  const searchResponse = YouTube.Search.list('snippet', {
    channelId: channelId,
    maxResults: limit || 5,
    order: 'date',
    type: 'video'
  });

  if (!searchResponse || !searchResponse.items || searchResponse.items.length === 0) {
    return [];
  }

  const videoIds = searchResponse.items.map(item => item.id.videoId).join(',');
  const videosResponse = YouTube.Videos.list('snippet,statistics', { id: videoIds });

  if (videosResponse && videosResponse.items) {
    return videosResponse.items.map(formatVideoItem);
  }
  return [];
}

function fetchTopVideos(channelId, limit) {
  const searchResponse = YouTube.Search.list('snippet', {
    channelId: channelId,
    maxResults: limit || 5,
    order: 'viewCount',
    type: 'video'
  });

  if (!searchResponse || !searchResponse.items || searchResponse.items.length === 0) {
    return [];
  }

  const videoIds = searchResponse.items.map(item => item.id.videoId).join(',');
  const videosResponse = YouTube.Videos.list('snippet,statistics', { id: videoIds });

  if (videosResponse && videosResponse.items) {
    const formatted = videosResponse.items.map(formatVideoItem);
    formatted.sort((a, b) => b.viewCount - a.viewCount);
    return formatted;
  }
  return [];
}

function formatVideoItem(item) {
  const snippet = item.snippet;
  const stats = item.statistics || {};
  const thumbs = snippet.thumbnails;
  const thumbUrl = (thumbs.medium || thumbs.high || thumbs.default || {}).url || '';

  return {
    id: item.id,
    title: snippet.title,
    publishedAt: snippet.publishedAt,
    thumbnailUrl: thumbUrl,
    videoUrl: 'https://www.youtube.com/watch?v=' + item.id,
    viewCount: parseInt(stats.viewCount || 0, 10),
    likeCount: parseInt(stats.likeCount || 0, 10),
    commentCount: parseInt(stats.commentCount || 0, 10)
  };
}

// ==========================================
// PERSISTENT STORAGE HELPERS
// ==========================================

function getGrowthAnalyticsData(currentSubs, currentViews) {
  try {
    const config = getConfig();
    const spreadsheetId = config.SPREADSHEET_ID;
    if (spreadsheetId) {
      const sheetName = config.ANALYTICS_SHEET_NAME || 'Data';
      const ss = SpreadsheetApp.openById(spreadsheetId);
      const sheet = ss.getSheetByName(sheetName);

      if (sheet && sheet.getLastRow() > 1) {
        const lastRow = sheet.getLastRow();
        const numRows = lastRow - 1;
        const startRow = 2;
        const dataRange = sheet.getRange(startRow, 1, numRows, 6).getValues();

        if (dataRange && dataRange.length > 0) {
          const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const days = [];
          const fullDates = [];
          const subs = [];
          const views = [];
          const subsDiffs = [];
          const viewsDiffs = [];

          dataRange.forEach(row => {
            const rawDate = row[0];
            let dayLabel = "";
            let fullDateStr = "";
            try {
              const d = new Date(rawDate);
              if (!isNaN(d.getTime())) {
                dayLabel = numRows <= 7
                  ? dayNames[d.getDay()]
                  : (d.getDate() + ' ' + monthNames[d.getMonth()]);
                fullDateStr = Utilities.formatDate(d, "Asia/Jakarta", "dd MMM yyyy");
              } else {
                dayLabel = String(rawDate);
                fullDateStr = String(rawDate);
              }
            } catch (e) {
              dayLabel = String(rawDate);
              fullDateStr = String(rawDate);
            }
            days.push(dayLabel);
            fullDates.push(fullDateStr);
            subs.push(Number(row[1]) || 0);
            views.push(Number(row[2]) || 0);
            subsDiffs.push(Number(row[4]) || 0);
            viewsDiffs.push(Number(row[5]) || 0);
          });

          const baseSubs = subs[0];
          const baseViews = views[0];
          const subsPct = subs.map(s => (baseSubs > 0 ? Number((((s - baseSubs) / baseSubs) * 100).toFixed(2)) : 0));
          const viewsPct = views.map(v => (baseViews > 0 ? Number((((v - baseViews) / baseViews) * 100).toFixed(2)) : 0));

          const totalSubsGrowth = subs.length > 1 ? (subs[subs.length - 1] - subs[0]) : (subsDiffs[0] || 0);
          const totalViewsGrowth = views.length > 1 ? (views[views.length - 1] - views[0]) : (viewsDiffs[0] || 0);
          const totalSubsPctGrowth = subsPct.length > 0 ? subsPct[subsPct.length - 1] : 0;
          const totalViewsPctGrowth = viewsPct.length > 0 ? viewsPct[viewsPct.length - 1] : 0;

          return {
            days: days,
            fullDates: fullDates,
            subscribers: subs,
            views: views,
            subsPercentages: subsPct,
            viewsPercentages: viewsPct,
            subsDiffs: subsDiffs,
            viewsDiffs: viewsDiffs,
            subsGrowth: totalSubsGrowth,
            viewsGrowth: totalViewsGrowth,
            totalSubsPctGrowth: totalSubsPctGrowth,
            totalViewsPctGrowth: totalViewsPctGrowth,
            totalRecords: subs.length
          };
        }
      }
    }
  } catch (err) {
    Logger.log("Error in getGrowthAnalyticsData from sheet: " + err.toString());
  }

  return getFallbackGrowthData(currentSubs, currentViews);
}

function getFallbackGrowthData(currentSubs, currentViews) {
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const totalDays = 14;
  const days = [];
  const fullDates = [];
  const subs = [];
  const views = [];
  const subsDiffs = [12, 18, 15, 22, 28, 20, 35, 24, 30, 26, 32, 28, 38, 42];
  const viewsDiffs = [1400, 1900, 1600, 2400, 3100, 2200, 3800, 2700, 3400, 3000, 3900, 3300, 4400, 4900];

  const totalSubsInc = subsDiffs.reduce((a, b) => a + b, 0);
  const totalViewsInc = viewsDiffs.reduce((a, b) => a + b, 0);

  const baseSubs = (currentSubs || 12500) - totalSubsInc;
  const baseViews = (currentViews || 485000) - totalViewsInc;

  let runningSubs = baseSubs;
  let runningViews = baseViews;

  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000);
    days.push(d.getDate() + ' ' + monthNames[d.getMonth()]);
    fullDates.push(Utilities.formatDate(d, "Asia/Jakarta", "dd MMM yyyy"));
    const idx = (totalDays - 1) - i;
    runningSubs += subsDiffs[idx];
    runningViews += viewsDiffs[idx];
    subs.push(runningSubs);
    views.push(runningViews);
  }

  const baselineSubs = subs[0];
  const baselineViews = views[0];
  const subsPct = subs.map(s => (baselineSubs > 0 ? Number((((s - baselineSubs) / baseSubs) * 100).toFixed(2)) : 0));
  const viewsPct = views.map(v => (baselineViews > 0 ? Number((((v - baselineViews) / baseViews) * 100).toFixed(2)) : 0));

  return {
    days: days,
    fullDates: fullDates,
    subscribers: subs,
    views: views,
    subsPercentages: subsPct,
    viewsPercentages: viewsPct,
    subsDiffs: subsDiffs,
    viewsDiffs: viewsDiffs,
    subsGrowth: totalSubsInc,
    viewsGrowth: totalViewsInc,
    totalSubsPctGrowth: subsPct[subsPct.length - 1],
    totalViewsPctGrowth: viewsPct[viewsPct.length - 1],
    totalRecords: subs.length
  };
}

function getIdeasStorage() {
  try {
    const config = getConfig();
    const spreadsheetId = config.SPREADSHEET_ID;
    if (spreadsheetId) {
      const sheetName = config.IDEAS_SHEET_NAME || 'Ideas';
      const ss = SpreadsheetApp.openById(spreadsheetId);
      const sheet = ss.getSheetByName(sheetName);

      if (sheet) {
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          const data = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
          return data.map(row => {
            const rawStatus = (row[2] || '').toString().toUpperCase();
            return {
              id: row[0],
              text: row[1],
              status: rawStatus === 'DONE' ? 'completed' : 'pending',
              rawStatus: rawStatus || 'PLANNED',
              createdAt: row[3] ? row[3].toString() : ''
            };
          });
        }
        return [];
      }
    }
  } catch (err) {
    Logger.log("Error reading sheet ideas: " + err.toString());
  }

  return getIdeasStorageFromProps();
}

function getIdeasStorageFromProps() {
  try {
    const props = PropertiesService.getScriptProperties();
    const raw = props.getProperty('YOUTUBE_IDEAS_DATA');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    Logger.log("Error reading ideas storage properties: " + err.toString());
  }

  return [
    {
      id: '1',
      text: 'Build a Telegram Mini App with Google Apps Script from scratch',
      status: 'pending',
      createdAt: Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy HH:mm")
    },
    {
      id: '2',
      text: 'Shorts 60s: 3 YouTube Data API v3 optimization tips in GAS',
      status: 'pending',
      createdAt: Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy HH:mm")
    }
  ];
}

function addNewIdeaToProps(text) {
  const ideas = getIdeasStorageFromProps();
  const newIdea = {
    id: String(ideas.length + 1),
    text: text,
    status: 'pending',
    createdAt: Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy HH:mm")
  };
  ideas.unshift(newIdea);
  try {
    PropertiesService.getScriptProperties().setProperty('YOUTUBE_IDEAS_DATA', JSON.stringify(ideas));
  } catch (e) {
    Logger.log("Error saving ideas to props: " + e.toString());
  }
}

function markIdeaDoneInProps(ideaId) {
  let ideas = getIdeasStorageFromProps();
  ideas = ideas.map(idea => {
    if (idea.id === ideaId || String(idea.id) === String(ideaId)) {
      idea.status = idea.status === 'completed' ? 'pending' : 'completed';
    }
    return idea;
  });
  try {
    PropertiesService.getScriptProperties().setProperty('YOUTUBE_IDEAS_DATA', JSON.stringify(ideas));
  } catch (e) {
    Logger.log("Error saving updated ideas to props: " + e.toString());
  }
}

// Fallback Mock Data
function getFallbackChannelStats() {
  return {
    id: 'UC_sample_channel',
    title: 'My YouTube Channel',
    customUrl: '@mychannel',
    avatarUrl: 'https://cdn-icons-png.flaticon.com/512/1384/1384060.png',
    subscriberCount: 12500,
    viewCount: 485000,
    videoCount: 84
  };
}

function getFallbackLatestVideos() {
  return [
    {
      id: 'demo_vid_1',
      title: 'Membuat Telegram Mini App dengan Google Apps Script dari Nol! 🚀',
      publishedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      thumbnailUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop&q=60',
      videoUrl: 'https://www.youtube.com',
      viewCount: 4520,
      likeCount: 382,
      commentCount: 45
    },
    {
      id: 'demo_vid_2',
      title: 'Tips Koding Efisien Menggunakan Antigravity AI Agent & GAS Web App',
      publishedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500&auto=format&fit=crop&q=60',
      videoUrl: 'https://www.youtube.com',
      viewCount: 8910,
      likeCount: 710,
      commentCount: 89
    },
    {
      id: 'demo_vid_3',
      title: 'Shorts: Caraku Mengelola Channel YouTube Pakai Telegram Bot',
      publishedAt: new Date(Date.now() - 86400000 * 9).toISOString(),
      thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60',
      videoUrl: 'https://www.youtube.com',
      viewCount: 15300,
      likeCount: 1420,
      commentCount: 112
    }
  ];
}

function getFallbackTopVideos() {
  return [
    {
      id: 'top_vid_1',
      title: 'Cara Otomatisasi Channel YouTube dengan Telegram Bot & Google Apps Script 🔥',
      publishedAt: new Date(Date.now() - 86400000 * 30).toISOString(),
      thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=500&auto=format&fit=crop&q=60',
      videoUrl: 'https://www.youtube.com',
      viewCount: 154200,
      likeCount: 12400,
      commentCount: 980
    },
    {
      id: 'top_vid_2',
      title: 'Shorts: 3 Trik Rahasia Algoritma YouTube 2026 yang Wajib Kamu Tahu!',
      publishedAt: new Date(Date.now() - 86400000 * 15).toISOString(),
      thumbnailUrl: 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=500&auto=format&fit=crop&q=60',
      videoUrl: 'https://www.youtube.com',
      viewCount: 89500,
      likeCount: 7800,
      commentCount: 450
    },
    {
      id: 'top_vid_3',
      title: 'Tips Koding Efisien Menggunakan Antigravity AI Agent & GAS Web App',
      publishedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
      thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=500&auto=format&fit=crop&q=60',
      videoUrl: 'https://www.youtube.com',
      viewCount: 45200,
      likeCount: 3900,
      commentCount: 310
    }
  ];
}
