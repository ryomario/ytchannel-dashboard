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
      return handleGetDashboardData(payload);

    case 'getIdeas':
      return handleGetIdeas();

    case 'createIdea':
      return handleCreateIdea(payload);

    case 'updateIdea':
      return handleUpdateIdea(payload);

    case 'deleteIdea':
      return handleDeleteIdea(payload);

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
 * Invalidate dashboard cache saat ada perubahan data
 */
function invalidateDashboardCache(channelId) {
  try {
    const targetChannel = channelId || getConfig().YOUTUBE_CHANNEL_ID || 'default';
    const cache = CacheService.getScriptCache();
    cache.remove('DASH_DATA_' + targetChannel);
    Logger.log('Dashboard cache invalidated for channel: ' + targetChannel);
  } catch (e) {
    Logger.log('Error invalidating cache: ' + e.message);
  }
}

/**
 * Invalidate ideas cache saat ada mutasi ide (create, update, delete)
 */
function invalidateIdeasCache() {
  try {
    const cache = CacheService.getScriptCache();
    cache.remove('IDEAS_DATA_CACHE');
    Logger.log('Ideas data cache invalidated');
  } catch (e) {
    Logger.log('Error invalidating ideas cache: ' + e.message);
  }
  invalidateDashboardCache();
}

/**
 * Action: getDashboardData
 * Mengambil metrik channel, video terbaru, video terpopuler, daftar ide, dan data analitik pertumbuhan.
 * Dilengkapi dengan CacheService (TTL 5 menit) untuk respon secepat kilat.
 */
function handleGetDashboardData(payload) {
  const config = getConfig();
  const channelId = config.YOUTUBE_CHANNEL_ID;
  const forceRefresh = Boolean(payload && payload.forceRefresh);
  const cacheKey = 'DASH_DATA_' + (channelId || 'default');
  const cache = CacheService.getScriptCache();

  // 1. Cek CacheService jika bukan force refresh
  if (!forceRefresh) {
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      try {
        Logger.log('⚡ Returning cached dashboard data from CacheService');
        return JSON.parse(cachedData);
      } catch (e) {
        Logger.log('Cache parse warning: ' + e.message);
      }
    }
  }

  try {
    // 2. Buka spreadsheet satu kali saja untuk dipakai bersama
    let ss = null;
    if (config.SPREADSHEET_ID) {
      try {
        ss = SpreadsheetApp.openById(config.SPREADSHEET_ID);
      } catch (ssErr) {
        Logger.log('Error opening spreadsheet: ' + ssErr.message);
      }
    }

    let channelStats = null;
    let latestVideos = [];
    let topVideos = [];

    // Cek apakah YouTube Advanced Service aktif
    if (typeof YouTube !== 'undefined' && YouTube.Channels) {
      channelStats = fetchChannelStats(channelId);
      if (channelStats && channelStats.id) {
        latestVideos = fetchLatestVideos(channelStats.id, 5, channelStats.uploadsPlaylistId);
        topVideos = fetchTopVideos(channelStats.id, 5, forceRefresh);
      }
    } else {
      Logger.log("YouTube Advanced Service not active. Returning fallback metrics.");
      channelStats = getFallbackChannelStats();
      latestVideos = getFallbackLatestVideos();
      topVideos = getFallbackTopVideos();
    }

    const ideas = getIdeasStorage(ss);
    const activeChannel = channelStats || getFallbackChannelStats();
    const growthData = getGrowthAnalyticsData(ss, activeChannel.subscriberCount, activeChannel.viewCount);

    const result = {
      success: true,
      channel: activeChannel,
      latestVideos: latestVideos.length > 0 ? latestVideos : getFallbackLatestVideos(),
      topVideos: topVideos.length > 0 ? topVideos : getFallbackTopVideos(),
      ideas: ideas,
      growthData: growthData
    };

    // 3. Simpan ke CacheService (TTL 300 detik = 5 menit)
    try {
      cache.put(cacheKey, JSON.stringify(result), 300);
      Logger.log('✅ Dashboard data cached successfully in CacheService (300s)');
    } catch (cacheErr) {
      Logger.log('Failed to cache dashboard data: ' + cacheErr.message);
    }

    return result;
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
 * Mengambil data ide dari CacheService jika tersedia
 * @returns {Array|null}
 */
function getCachedIdeas() {
  try {
    const cache = CacheService.getScriptCache();
    const cachedData = cache.get('IDEAS_DATA_CACHE');
    if (cachedData) {
      return JSON.parse(cachedData);
    }
  } catch (e) {
    Logger.log('Cache parse warning in getCachedIdeas: ' + e.message);
  }
  return null;
}

/**
 * Action: getIdeas
 * Mengambil daftar ide aktif dengan cache 2-tier (CacheService)
 */
function handleGetIdeas() {
  try {
    const cached = getCachedIdeas();
    if (cached) {
      return {
        success: true,
        statusCode: 200,
        data: cached
      };
    }

    const ideas = fetchIdeasFromSource();

    try {
      CacheService.getScriptCache().put('IDEAS_DATA_CACHE', JSON.stringify(ideas), 600); // 10 menit TTL
    } catch (cErr) {
      Logger.log('Cache put error in getIdeas: ' + cErr.message);
    }

    return {
      success: true,
      statusCode: 200,
      data: ideas
    };
  } catch (err) {
    Logger.log('Error in handleGetIdeas: ' + err.toString());
    return {
      success: false,
      statusCode: 500,
      error: err.toString(),
      data: []
    };
  }
}

/**
 * Action: createIdea
 * Menambahkan ide baru dengan batch append dan notifikasi Telegram
 */
function handleCreateIdea(payload) {
  try {
    payload = payload || {};
    const title = (payload.title || payload.text || '').trim();
    if (!title) {
      return { success: false, statusCode: 400, error: "Idea title cannot be empty." };
    }

    const id = payload.id || ('id_' + Utilities.getUuid().slice(0, 8) + '_' + Date.now().toString(36));
    const description = (payload.description || '').trim();
    const category = (payload.category || 'General').trim();
    const priority = (payload.priority || 'MEDIUM').toUpperCase();
    const status = (payload.status || 'DRAFT').toUpperCase();
    const now = new Date().toISOString();

    const config = getConfig();
    const spreadsheetId = config.SPREADSHEET_ID;

    if (spreadsheetId) {
      const ss = SpreadsheetApp.openById(spreadsheetId);
      const sheet = ensureIdeasSheetSchema(ss);
      sheet.appendRow([id, title, description, category, priority, status, false, now, now]);
    } else {
      let ideas = getIdeasStorageFromProps();
      ideas.unshift({
        id: id,
        title: title,
        description: description,
        category: category,
        priority: priority,
        status: status,
        is_deleted: false,
        created_at: now,
        updated_at: now
      });
      PropertiesService.getScriptProperties().setProperty('YOUTUBE_IDEAS_DATA_V2', JSON.stringify(ideas));
    }

    // Invalidate cache
    invalidateIdeasCache();

    // Notifikasi Telegram Topic jika ada
    if (typeof notifIdea === 'function') {
      try {
        notifIdea(id, title, status);
      } catch (e) {
        Logger.log("notifIdea warning: " + e.toString());
      }
    }

    return {
      success: true,
      statusCode: 201,
      data: { id: id }
    };
  } catch (err) {
    Logger.log("Error in handleCreateIdea: " + err.toString());
    return {
      success: false,
      statusCode: 500,
      error: err.toString()
    };
  }
}

/**
 * Action: updateIdea
 * Memperbarui data ide dengan in-memory batch operations
 */
function handleUpdateIdea(payload) {
  try {
    payload = payload || {};
    const id = payload.id;
    if (!id) {
      return { success: false, statusCode: 400, error: "Idea ID is required for update." };
    }

    const config = getConfig();
    const spreadsheetId = config.SPREADSHEET_ID;
    const now = new Date().toISOString();
    let updatedTitle = '';
    let updatedStatus = '';

    if (spreadsheetId) {
      const ss = SpreadsheetApp.openById(spreadsheetId);
      const sheet = ensureIdeasSheetSchema(ss);
      const lastRow = sheet.getLastRow();

      if (lastRow > 1) {
        // In-memory batch read & write
        const range = sheet.getRange(1, 1, lastRow, 9);
        const values = range.getValues();
        let found = false;

        for (let i = 1; i < values.length; i++) {
          if (String(values[i][0]) === String(id)) {
            if (payload.title !== undefined) values[i][1] = String(payload.title).trim();
            if (payload.description !== undefined) values[i][2] = String(payload.description).trim();
            if (payload.category !== undefined) values[i][3] = String(payload.category).trim();
            if (payload.priority !== undefined) values[i][4] = String(payload.priority).toUpperCase();
            if (payload.status !== undefined) values[i][5] = String(payload.status).toUpperCase();
            values[i][8] = now;

            updatedTitle = values[i][1];
            updatedStatus = values[i][5];
            found = true;
            break;
          }
        }

        if (!found) {
          return { success: false, statusCode: 404, error: "Idea not found." };
        }

        range.setValues(values);
      }
    } else {
      let ideas = getIdeasStorageFromProps();
      let found = false;
      ideas = ideas.map(idea => {
        if (String(idea.id) === String(id)) {
          found = true;
          if (payload.title !== undefined) idea.title = String(payload.title).trim();
          if (payload.description !== undefined) idea.description = String(payload.description).trim();
          if (payload.category !== undefined) idea.category = String(payload.category).trim();
          if (payload.priority !== undefined) idea.priority = String(payload.priority).toUpperCase();
          if (payload.status !== undefined) idea.status = String(payload.status).toUpperCase();
          idea.updated_at = now;
          updatedTitle = idea.title;
          updatedStatus = idea.status;
        }
        return idea;
      });

      if (!found) {
        return { success: false, statusCode: 404, error: "Idea not found." };
      }
      PropertiesService.getScriptProperties().setProperty('YOUTUBE_IDEAS_DATA_V2', JSON.stringify(ideas));
    }

    invalidateIdeasCache();

    if (updatedStatus === 'DONE' && typeof notifIdea === 'function') {
      try {
        notifIdea(id, updatedTitle, 'DONE');
      } catch (e) {
        Logger.log("notifIdea warning: " + e.toString());
      }
    }

    return {
      success: true,
      statusCode: 200,
      message: "Idea updated successfully"
    };
  } catch (err) {
    Logger.log("Error in handleUpdateIdea: " + err.toString());
    return {
      success: false,
      statusCode: 500,
      error: err.toString()
    };
  }
}

/**
 * Action: deleteIdea (Soft Delete)
 * Menandai is_deleted = true pada baris yang sesuai
 */
function handleDeleteIdea(payload) {
  try {
    payload = payload || {};
    const id = payload.id;
    if (!id) {
      return { success: false, statusCode: 400, error: "Idea ID is required for deletion." };
    }

    const config = getConfig();
    const spreadsheetId = config.SPREADSHEET_ID;
    const now = new Date().toISOString();

    if (spreadsheetId) {
      const ss = SpreadsheetApp.openById(spreadsheetId);
      const sheet = ensureIdeasSheetSchema(ss);
      const lastRow = sheet.getLastRow();

      if (lastRow > 1) {
        const range = sheet.getRange(1, 1, lastRow, 9);
        const values = range.getValues();
        let found = false;

        for (let i = 1; i < values.length; i++) {
          if (String(values[i][0]) === String(id)) {
            values[i][6] = true; // is_deleted = true
            values[i][8] = now;
            found = true;
            break;
          }
        }

        if (!found) {
          return { success: false, statusCode: 404, error: "Idea not found." };
        }

        range.setValues(values);
      }
    } else {
      let ideas = getIdeasStorageFromProps();
      ideas = ideas.map(idea => {
        if (String(idea.id) === String(id)) {
          idea.is_deleted = true;
          idea.updated_at = now;
        }
        return idea;
      });
      PropertiesService.getScriptProperties().setProperty('YOUTUBE_IDEAS_DATA_V2', JSON.stringify(ideas));
    }

    invalidateIdeasCache();

    return {
      success: true,
      statusCode: 200,
      message: "Idea soft deleted"
    };
  } catch (err) {
    Logger.log("Error in handleDeleteIdea: " + err.toString());
    return {
      success: false,
      statusCode: 500,
      error: err.toString()
    };
  }
}

/**
 * Legacy Compatibility: addNewIdea
 */
function handleAddNewIdea(text) {
  const result = handleCreateIdea({ title: text });
  return {
    success: result.success,
    error: result.error,
    ideas: fetchIdeasFromSource()
  };
}

/**
 * Legacy Compatibility: markIdeaDone
 */
function handleMarkIdeaDone(ideaId) {
  const ideas = fetchIdeasFromSource();
  const target = ideas.find(i => String(i.id) === String(ideaId));
  const newStatus = (target && target.status === 'DONE') ? 'DRAFT' : 'DONE';
  const result = handleUpdateIdea({ id: ideaId, status: newStatus });
  return {
    success: result.success,
    error: result.error,
    ideas: fetchIdeasFromSource()
  };
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
  const params = { snippet: true, statistics: true, contentDetails: true };
  if (channelId) {
    params.id = channelId;
  } else {
    params.mine = true;
  }

  const response = YouTube.Channels.list(['snippet', 'statistics', 'contentDetails'], params);
  if (response && response.items && response.items.length > 0) {
    const item = response.items[0];
    const uploadsPlaylistId = (item.contentDetails && item.contentDetails.relatedPlaylists)
      ? item.contentDetails.relatedPlaylists.uploads
      : null;

    return {
      id: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      customUrl: item.snippet.customUrl || '',
      avatarUrl: item.snippet.thumbnails.default.url,
      subscriberCount: parseInt(item.statistics.subscriberCount || 0, 10),
      viewCount: parseInt(item.statistics.viewCount || 0, 10),
      videoCount: parseInt(item.statistics.videoCount || 0, 10),
      uploadsPlaylistId: uploadsPlaylistId
    };
  }
  return null;
}

function fetchLatestVideos(channelId, limit, uploadsPlaylistId) {
  try {
    // Jalur Cepat: Gunakan PlaylistItems pada Uploads Playlist (Jauh lebih cepat dari Search.list)
    if (uploadsPlaylistId) {
      const playlistResponse = YouTube.PlaylistItems.list('snippet', {
        playlistId: uploadsPlaylistId,
        maxResults: limit || 5
      });

      if (playlistResponse && playlistResponse.items && playlistResponse.items.length > 0) {
        const videoIds = playlistResponse.items
          .map(item => item.snippet.resourceId && item.snippet.resourceId.videoId)
          .filter(Boolean)
          .join(',');

        if (videoIds) {
          const videosResponse = YouTube.Videos.list('snippet,statistics', { id: videoIds });
          if (videosResponse && videosResponse.items) {
            return videosResponse.items.map(formatVideoItem);
          }
        }
      }
    }

    // Fallback jika playlist uploads tidak ditemukan
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
  } catch (e) {
    Logger.log('Error in fetchLatestVideos: ' + e.message);
  }
  return [];
}

function fetchTopVideos(channelId, limit, forceRefresh = false) {
  const cache = CacheService.getScriptCache();
  const cacheKey = 'TOP_VIDS_' + (channelId || 'default');

  if (!forceRefresh) {
    const cached = cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {}
    }
  }

  try {
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

      try {
        cache.put(cacheKey, JSON.stringify(formatted), 1800); // Cache 30 menit
      } catch (e) {}

      return formatted;
    }
  } catch (e) {
    Logger.log('Error in fetchTopVideos: ' + e.message);
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

function getGrowthAnalyticsData(passedSs, currentSubs, currentViews) {
  try {
    const config = getConfig();
    const spreadsheetId = config.SPREADSHEET_ID;
    if (spreadsheetId || passedSs) {
      const sheetName = config.ANALYTICS_SHEET_NAME || 'Data';
      const ss = passedSs || SpreadsheetApp.openById(spreadsheetId);
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
          const isoDates = [];
          const timestamps = [];
          const subs = [];
          const views = [];
          const subsDiffs = [];
          const viewsDiffs = [];

          dataRange.forEach(row => {
            const rawDate = row[0];
            let dayLabel = "";
            let fullDateStr = "";
            let isoDateStr = "";
            let ts = 0;
            try {
              const d = new Date(rawDate);
              if (!isNaN(d.getTime())) {
                ts = d.getTime();
                dayLabel = numRows <= 7
                  ? dayNames[d.getDay()]
                  : (d.getDate() + ' ' + monthNames[d.getMonth()]);
                fullDateStr = Utilities.formatDate(d, "Asia/Jakarta", "dd MMM yyyy");
                isoDateStr = Utilities.formatDate(d, "Asia/Jakarta", "yyyy-MM-dd");
              } else {
                dayLabel = String(rawDate);
                fullDateStr = String(rawDate);
                isoDateStr = String(rawDate);
              }
            } catch (e) {
              dayLabel = String(rawDate);
              fullDateStr = String(rawDate);
              isoDateStr = String(rawDate);
            }
            days.push(dayLabel);
            fullDates.push(fullDateStr);
            isoDates.push(isoDateStr);
            timestamps.push(ts);
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
            isoDates: isoDates,
            timestamps: timestamps,
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
  const isoDates = [];
  const timestamps = [];
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
    isoDates.push(Utilities.formatDate(d, "Asia/Jakarta", "yyyy-MM-dd"));
    timestamps.push(d.getTime());
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
    isoDates: isoDates,
    timestamps: timestamps,
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

const IDEAS_HEADERS = ["id", "title", "description", "category", "priority", "status", "is_deleted", "created_at", "updated_at"];

/**
 * Memastikan header 9 kolom pada sheet Ideas dan migrasi data lama jika diperlukan
 */
function ensureIdeasSheetSchema(ss) {
  const config = getConfig();
  const sheetName = config.IDEAS_SHEET_NAME || 'Ideas';
  let sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(IDEAS_HEADERS);
    return sheet;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();

  if (lastRow === 0) {
    sheet.appendRow(IDEAS_HEADERS);
    return sheet;
  }

  // Cek apakah header sudah 9 kolom atau masih format 4 kolom (ID, Text Ide, Status, Tanggal Dibuat)
  const currentHeaders = sheet.getRange(1, 1, 1, Math.max(lastCol, 1)).getValues()[0];
  const secondHeader = String(currentHeaders[1] || '').trim().toLowerCase();

  // Jika kolom kedua adalah 'text ide' atau jumlah kolom < 9, lakukan migrasi data in-memory
  if (currentHeaders.length < 9 || secondHeader === 'text ide') {
    Logger.log("Migrating Ideas sheet schema to 9 columns standard...");
    const rawData = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const rows = rawData.slice(1); // skip header lama

    const migratedRows = rows.map((r, idx) => {
      const id = String(r[0] || ('id_' + (idx + 1)));
      const title = String(r[1] || '');
      const rawStatus = String(r[2] || '').trim().toUpperCase();
      const status = rawStatus === 'DONE' ? 'DONE' : (rawStatus === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'DRAFT');
      const createdAt = r[3] ? String(r[3]) : new Date().toISOString();
      return [
        id,
        title,
        '', // description
        'General', // category
        'MEDIUM', // priority
        status,
        false, // is_deleted
        createdAt,
        new Date().toISOString() // updated_at
      ];
    });

    sheet.clearContents();
    sheet.getRange(1, 1, 1, IDEAS_HEADERS.length).setValues([IDEAS_HEADERS]);
    if (migratedRows.length > 0) {
      sheet.getRange(2, 1, migratedRows.length, IDEAS_HEADERS.length).setValues(migratedRows);
    }
  }

  return sheet;
}

/**
 * Mengambil daftar ide aktif dari Spreadsheet atau fallback PropertiesService
 */
function fetchIdeasFromSource(passedSs) {
  try {
    const config = getConfig();
    const spreadsheetId = config.SPREADSHEET_ID;
    if (spreadsheetId || passedSs) {
      const ss = passedSs || SpreadsheetApp.openById(spreadsheetId);
      const sheet = ensureIdeasSheetSchema(ss);

      if (sheet) {
        const lastRow = sheet.getLastRow();
        if (lastRow > 1) {
          const range = sheet.getRange(2, 1, lastRow - 1, 9);
          const data = range.getValues();
          const activeIdeas = [];

          for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const isDeleted = Boolean(row[6] === true || String(row[6]).toUpperCase() === 'TRUE');
            if (isDeleted) continue;

            const id = String(row[0]);
            const title = String(row[1] || '');
            const description = String(row[2] || '');
            const category = String(row[3] || 'General');
            const priority = String(row[4] || 'MEDIUM').toUpperCase();
            const status = String(row[5] || 'DRAFT').toUpperCase();
            const createdAt = row[7] ? String(row[7]) : new Date().toISOString();
            const updatedAt = row[8] ? String(row[8]) : createdAt;

            activeIdeas.push({
              id: id,
              title: title,
              description: description,
              category: category,
              priority: priority,
              status: status,
              is_deleted: false,
              created_at: createdAt,
              updated_at: updatedAt,
              // Kompatibilitas dengan pembacaan dashboard lama
              text: title,
              statusLegacy: status === 'DONE' ? 'completed' : 'pending'
            });
          }
          return activeIdeas;
        }
        return [];
      }
    }
  } catch (err) {
    Logger.log("Error reading sheet ideas: " + err.toString());
  }

  return getIdeasStorageFromProps();
}

function getIdeasStorage(passedSs) {
  return fetchIdeasFromSource(passedSs);
}

function getIdeasStorageFromProps() {
  try {
    const props = PropertiesService.getScriptProperties();
    const raw = props.getProperty('YOUTUBE_IDEAS_DATA_V2') || props.getProperty('YOUTUBE_IDEAS_DATA');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed.filter(item => !item.is_deleted).map(item => ({
        id: String(item.id),
        title: item.title || item.text || '',
        description: item.description || '',
        category: item.category || 'General',
        priority: item.priority || 'MEDIUM',
        status: item.status ? item.status.toUpperCase() : 'DRAFT',
        is_deleted: Boolean(item.is_deleted),
        created_at: item.created_at || item.createdAt || new Date().toISOString(),
        updated_at: item.updated_at || new Date().toISOString(),
        text: item.title || item.text || '',
        statusLegacy: (item.status && item.status.toUpperCase() === 'DONE') ? 'completed' : 'pending'
      }));
    }
  } catch (err) {
    Logger.log("Error reading ideas storage properties: " + err.toString());
  }

  return [
    {
      id: 'id_demo_1',
      title: 'Build a Telegram Mini App with Google Apps Script from scratch',
      description: 'Tutorial arsitektur serverless Google Sheets & HMAC auth',
      category: 'Tech',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      text: 'Build a Telegram Mini App with Google Apps Script from scratch',
      statusLegacy: 'pending'
    },
    {
      id: 'id_demo_2',
      title: 'Shorts 60s: 3 YouTube Data API v3 optimization tips in GAS',
      description: 'Tips batch operations & CacheService',
      category: 'Tips',
      priority: 'MEDIUM',
      status: 'DRAFT',
      is_deleted: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      text: 'Shorts 60s: 3 YouTube Data API v3 optimization tips in GAS',
      statusLegacy: 'pending'
    }
  ];
}

function addNewIdeaToProps(text) {
  const ideas = getIdeasStorageFromProps();
  const now = new Date().toISOString();
  const newIdea = {
    id: 'id_' + (ideas.length + 1) + '_' + Date.now().toString(36),
    title: text,
    description: '',
    category: 'General',
    priority: 'MEDIUM',
    status: 'DRAFT',
    is_deleted: false,
    created_at: now,
    updated_at: now
  };
  ideas.unshift(newIdea);
  try {
    PropertiesService.getScriptProperties().setProperty('YOUTUBE_IDEAS_DATA_V2', JSON.stringify(ideas));
  } catch (e) {
    Logger.log("Error saving ideas to props: " + e.toString());
  }
}

function markIdeaDoneInProps(ideaId) {
  let ideas = getIdeasStorageFromProps();
  const now = new Date().toISOString();
  ideas = ideas.map(idea => {
    if (idea.id === ideaId || String(idea.id) === String(ideaId)) {
      idea.status = (idea.status === 'DONE') ? 'DRAFT' : 'DONE';
      idea.updated_at = now;
    }
    return idea;
  });
  try {
    PropertiesService.getScriptProperties().setProperty('YOUTUBE_IDEAS_DATA_V2', JSON.stringify(ideas));
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
