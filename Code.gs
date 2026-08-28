/**
 * YouTube Channel Observer & Manager — Telegram Mini App (GAS Edition)
 * File: Code.gs
 */

// Configuration Property Keys
const PROP_CHANNEL_ID = 'CHANNEL_ID';
const PROP_IDEAS_KEY = 'YOUTUBE_IDEAS_DATA';

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

/**
 * Server-Side Include Helper
 * Used in Index.html: <?!= include('Styles'); ?> and <?!= include('Scripts'); ?>
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Telegram Webhook Handler (Placeholder for existing bot commands)
 * Keep your existing doPost(e) code here or merge your command router!
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput("No contents");
    }
    const contents = JSON.parse(e.postData.contents);
    // User's custom Telegram bot webhook logic goes here
    return ContentService.createTextOutput("OK");
  } catch (err) {
    Logger.log("doPost Error: " + err.toString());
    return ContentService.createTextOutput("ERROR: " + err.toString());
  }
}

// ==========================================
// CLIENT-CALLABLE RPC ENDPOINTS (google.script.run)
// ==========================================

/**
 * RPC 1: Fetch overall channel dashboard data
 * Returns: { success: boolean, channel: object, latestVideos: array, ideas: array, error?: string }
 */
function getChannelDashboardData() {
  try {
    const channelId = getStoredChannelId();
    let channelStats = null;
    let latestVideos = [];

    // Attempt fetching live YouTube Data if YouTube API service is available
    if (typeof YouTube !== 'undefined' && YouTube.Channels) {
      channelStats = fetchChannelStats(channelId);
      if (channelStats && channelStats.id) {
        latestVideos = fetchLatestVideos(channelStats.id, 5);
      }
    } else {
      Logger.log("YouTube Advanced Service is not enabled. Returning fallback/mock channel metrics.");
      channelStats = getFallbackChannelStats();
      latestVideos = getFallbackLatestVideos();
    }

    const ideas = getIdeasStorage();

    return {
      success: true,
      channel: channelStats || getFallbackChannelStats(),
      latestVideos: latestVideos.length > 0 ? latestVideos : getFallbackLatestVideos(),
      ideas: ideas
    };
  } catch (err) {
    Logger.log("Error in getChannelDashboardData: " + err.toString());
    return {
      success: false,
      error: err.toString(),
      channel: getFallbackChannelStats(),
      latestVideos: getFallbackLatestVideos(),
      ideas: getIdeasStorage()
    };
  }
}

/**
 * RPC 2: Add new content idea from Web App
 */
function addNewIdeaFromWebApp(text) {
  try {
    if (!text || !text.trim()) {
      throw new Error("Idea text cannot be empty.");
    }
    const cleanText = text.trim();
    const spreadsheetId = getSpreadsheetId();

    if (spreadsheetId) {
      const sheetName = getIdeasSheetName();
      const ss = SpreadsheetApp.openById(spreadsheetId);
      let sheet = ss.getSheetByName(sheetName);
      if (!sheet) {
        sheet = ss.insertSheet(sheetName);
        sheet.appendRow(["ID", "Text Ide", "Status", "Tanggal Dibuat"]);
      }

      const lastRow = sheet.getLastRow();
      const newId = lastRow; // Auto increment ID berdasarkan baris (sama seperti ContentPlanner.gs)
      const createdAt = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy HH:mm");

      sheet.appendRow([newId, cleanText, "PLANNED", createdAt]);

      // Kirim notifikasi Telegram jika fungsi notifIdea tersedia dari ContentPlanner.gs
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
    Logger.log("Error in addNewIdeaFromWebApp: " + err.toString());
    return {
      success: false,
      error: err.toString(),
      ideas: getIdeasStorage()
    };
  }
}

/**
 * RPC 3: Mark an idea as done/completed from Web App
 */
function markIdeaDoneFromWebApp(ideaId) {
  try {
    const spreadsheetId = getSpreadsheetId();

    if (spreadsheetId) {
      const sheetName = getIdeasSheetName();
      const ss = SpreadsheetApp.openById(spreadsheetId);
      const sheet = ss.getSheetByName(sheetName);

      if (sheet && sheet.getLastRow() > 1) {
        const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
        let foundRow = -1;
        let ideaText = "";
        let currentStatus = "";

        for (let i = 0; i < data.length; i++) {
          if (data[i][0] == ideaId || String(data[i][0]) === String(ideaId)) {
            foundRow = i + 2; // Offset header
            ideaText = data[i][1];
            currentStatus = data[i][2];
            break;
          }
        }

        if (foundRow !== -1) {
          const newStatus = (currentStatus === "DONE") ? "PLANNED" : "DONE";
          sheet.getRange(foundRow, 3).setValue(newStatus);

          // Kirim notifikasi Telegram jika notifIdea tersedia
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
    Logger.log("Error in markIdeaDoneFromWebApp: " + err.toString());
    return {
      success: false,
      error: err.toString(),
      ideas: getIdeasStorage()
    };
  }
}

/**
 * RPC 4: Search channel videos by topic/keyword
 */
function searchVideosFromWebApp(query) {
  try {
    if (!query || !query.trim()) {
      return { success: true, videos: [] };
    }

    const channelId = getStoredChannelId();
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
      // Filter fallback videos by search query if YouTube API is disabled
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
    Logger.log("Error in searchVideosFromWebApp: " + err.toString());
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

function getStoredChannelId() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty(PROP_CHANNEL_ID) || '';
}

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

function formatVideoItem(item) {
  const snippet = item.snippet;
  const stats = item.statistics || {};
  
  // Pick best available thumbnail
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
// PERSISTENT IDEAS STORAGE (Google Sheets & Properties Fallback)
// ==========================================

function getSpreadsheetId() {
  if (typeof CONFIG !== 'undefined' && CONFIG.SPREADSHEET_ID) {
    return CONFIG.SPREADSHEET_ID;
  }
  return PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID') || '';
}

function getIdeasSheetName() {
  if (typeof CONFIG !== 'undefined' && CONFIG.IDEAS_SHEET_NAME) {
    return CONFIG.IDEAS_SHEET_NAME;
  }
  return PropertiesService.getScriptProperties().getProperty('IDEAS_SHEET_NAME') || 'Ideas';
}

function getIdeasStorage() {
  try {
    const spreadsheetId = getSpreadsheetId();
    if (spreadsheetId) {
      const sheetName = getIdeasSheetName();
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

  // Fallback to PropertiesService if spreadsheet is not configured
  return getIdeasStorageFromProps();
}

function getIdeasStorageFromProps() {
  try {
    const props = PropertiesService.getScriptProperties();
    const raw = props.getProperty(PROP_IDEAS_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    Logger.log("Error reading ideas storage properties: " + err.toString());
  }

  const defaultIdeas = [
    {
      id: '1',
      text: 'Bikin tutorial Telegram Mini App menggunakan Google Apps Script',
      status: 'pending',
      createdAt: Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy HH:mm")
    },
    {
      id: '2',
      text: 'Shorts 60s: 3 Tips Optimasi YouTube Data API v3 di GAS',
      status: 'pending',
      createdAt: Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy HH:mm")
    }
  ];
  return defaultIdeas;
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
    PropertiesService.getScriptProperties().setProperty(PROP_IDEAS_KEY, JSON.stringify(ideas));
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
    PropertiesService.getScriptProperties().setProperty(PROP_IDEAS_KEY, JSON.stringify(ideas));
  } catch (e) {
    Logger.log("Error saving updated ideas to props: " + e.toString());
  }
}

// ==========================================
// FALLBACK / MOCK DATA (When API not configured)
// ==========================================

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
