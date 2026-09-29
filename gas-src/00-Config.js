/**
 * ===================================================
 * 00-CONFIG.JS — BACKEND CONFIGURATION SERVICE
 * Mengambil konfigurasi dari Google Apps Script Script Properties.
 * Diberi prefix 00- agar dimuat pertama kali dalam urutan kompilasi GAS.
 * ===================================================
 */

var _cachedConfig = null;

function getRequiredScriptProperty(props,props, name) {
  const value = String(props[name] || '').trim();
  if (!value) {
    throw new Error('Missing required Script Property: ' + name + '. Set it in Project Settings -> Script Properties.');
  }
  return value;
}

function getOptionalScriptProperty(props,props, name, fallback) {
  const rawValue = props[name];
  if (rawValue === null || rawValue === undefined || String(rawValue).trim() === '') {
    return fallback;
  }
  return String(rawValue).trim();
}

/**
 * Mengambil seluruh konfigurasi aktif dari Script Properties.
 * Fail closed: jika properti penting tidak ada, throw error supaya tidak berjalan dengan secret default.
 * @param {boolean} [forceReload=false] - Jika true, paksa baca ulang dari Script Properties
 */
function getConfig(forceReload = false) {
  if (_cachedConfig && !forceReload) return _cachedConfig;
  const props = PropertiesService.getScriptProperties().getProperties();

  const requiredKeys = [
    'APP_SHARED_SECRET',
    'YOUTUBE_CHANNEL_ID',
    'TELEGRAM_TOKEN',
    'TELEGRAM_CHAT_ID',
    'SPREADSHEET_ID'
  ];

  const missingKeys = [];
  requiredKeys.forEach(function(key) {
    if (!String(props[key] || '').trim()) {
      missingKeys.push(key);
    }
  });

  if (missingKeys.length > 0) {
    const errorMessage = 'Missing required Script Properties: ' + missingKeys.join(', ');
    Logger.log(errorMessage);
    throw new Error(errorMessage);
  }

  let topics = {
    GENERAL: 1,
    NOTIF: 22,
    IDEAS: 26,
    REPORTS: 32
  };

  if (props.TELEGRAM_TOPICS_JSON) {
    try {
      topics = JSON.parse(props.TELEGRAM_TOPICS_JSON);
    } catch (e) {
      Logger.log('Error parsing TELEGRAM_TOPICS_JSON: ' + e.message);
    }
  }

  const adminIds = (props.TELEGRAM_ADMIN_IDS || props.TELEGRAM_CHAT_ID || '')
    .split(',')
    .map(function(id) { return String(id).trim(); })
    .filter(Boolean);

  _cachedConfig = {
    APP_SHARED_SECRET: getRequiredScriptProperty(props,'APP_SHARED_SECRET'),
    TELEGRAM_SECRET_HEADER: getOptionalScriptProperty(props,'TELEGRAM_SECRET_HEADER', ''),
    TELEGRAM_ADMIN_IDS: adminIds,
    YOUTUBE_CHANNEL_ID: getRequiredScriptProperty(props,'YOUTUBE_CHANNEL_ID'),
    TELEGRAM_TOKEN: getRequiredScriptProperty(props,'TELEGRAM_TOKEN'),
    TELEGRAM_CHAT_ID: getRequiredScriptProperty(props,'TELEGRAM_CHAT_ID'),
    TELEGRAM_GROUP_CHAT_ID: getOptionalScriptProperty(props,'TELEGRAM_GROUP_CHAT_ID', ''),
    TELEGRAM_GROUP_CHAT_TOPICS: topics,
    SPREADSHEET_ID: getRequiredScriptProperty(props,'SPREADSHEET_ID'),
    ANALYTICS_SHEET_NAME: getOptionalScriptProperty(props,'ANALYTICS_SHEET_NAME', 'Data'),
    IDEAS_SHEET_NAME: getOptionalScriptProperty(props,'IDEAS_SHEET_NAME', 'Ideas')
  };

  return _cachedConfig;
}

/**
 * Objek Proxy/Getter Global untuk menjaga backward compatibility
 * dengan skrip lain yang mengakses CONFIG.<KEY>.
 * Menggunakan deklarasi 'var' agar ter-hoist dan aman dari Temporal Dead Zone (TDZ).
 */
var CONFIG = {
  get APP_SHARED_SECRET() { return getConfig().APP_SHARED_SECRET; },
  get TELEGRAM_SECRET_HEADER() { return getConfig().TELEGRAM_SECRET_HEADER; },
  get TELEGRAM_ADMIN_IDS() { return getConfig().TELEGRAM_ADMIN_IDS; },
  get YOUTUBE_CHANNEL_ID() { return getConfig().YOUTUBE_CHANNEL_ID; },
  get TELEGRAM_TOKEN() { return getConfig().TELEGRAM_TOKEN; },
  get TELEGRAM_CHAT_ID() { return getConfig().TELEGRAM_CHAT_ID; },
  get TELEGRAM_GROUP_CHAT_ID() { return getConfig().TELEGRAM_GROUP_CHAT_ID; },
  get TELEGRAM_GROUP_CHAT_TOPICS() { return getConfig().TELEGRAM_GROUP_CHAT_TOPICS; },
  get SPREADSHEET_ID() { return getConfig().SPREADSHEET_ID; },
  get ANALYTICS_SHEET_NAME() { return getConfig().ANALYTICS_SHEET_NAME; },
  get IDEAS_SHEET_NAME() { return getConfig().IDEAS_SHEET_NAME; },
};

/**
 * Helper Sekali Jalan: Menginisialisasi Script Properties dengan nilai awal proyek.
 * Jalankan fungsi ini sekali di Apps Script Editor jika ingin mengisi properti secara otomatis.
 */
function setupInitialScriptProperties() {
  const initialProps = {
    APP_SHARED_SECRET: '',
    TELEGRAM_SECRET_HEADER: '',
    TELEGRAM_ADMIN_IDS: '',
    YOUTUBE_CHANNEL_ID: '',
    TELEGRAM_TOKEN: '',
    TELEGRAM_CHAT_ID: '',
    TELEGRAM_GROUP_CHAT_ID: '',
    TELEGRAM_TOPICS_JSON: JSON.stringify({
      GENERAL: 1,
      NOTIF: 22,
      IDEAS: 26,
      REPORTS: 32
    }),
    SPREADSHEET_ID: '',
    ANALYTICS_SHEET_NAME: 'Data',
    IDEAS_SHEET_NAME: 'Ideas'
  };

  PropertiesService.getScriptProperties().setProperties(initialProps, false);
  Logger.log('Script Properties initialized with empty values. Set real credentials in Project Settings -> Script Properties.');
  clearAllAppCache();
}

/**
 * Helper: Membersihkan seluruh cache aplikasi (ScriptCache & in-memory config).
 * Jalankan fungsi ini di Apps Script Editor jika Anda baru saja mengubah
 * nilai di Project Settings -> Script Properties dan ingin perubahannya
 * langsung aktif seketika tanpa menunggu sisa waktu TTL cache.
 */
function clearAllAppCache() {
  _cachedConfig = null;
  const props = PropertiesService.getScriptProperties().getProperties();
  const channelId = props.YOUTUBE_CHANNEL_ID || 'default';

  try {
    const cache = CacheService.getScriptCache();
    cache.remove('DASH_DATA_' + channelId);
    cache.remove('TOP_VIDS_' + channelId);
    Logger.log('✅ Seluruh cache aplikasi (DASH_DATA & TOP_VIDS) berhasil dibersihkan!');
  } catch (e) {
    Logger.log('Error clearAllAppCache: ' + e.message);
  }
}
