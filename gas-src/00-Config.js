/**
 * ===================================================
 * 00-CONFIG.JS — BACKEND CONFIGURATION SERVICE
 * Mengambil konfigurasi dari Google Apps Script Script Properties.
 * Diberi prefix 00- agar dimuat pertama kali dalam urutan kompilasi GAS.
 * ===================================================
 */

/**
 * Mengambil seluruh konfigurasi aktif dari Script Properties
 * dengan fallback default jika property belum disetel.
 */
function getConfig() {
  const props = PropertiesService.getScriptProperties().getProperties();

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
      Logger.log("Error parsing TELEGRAM_TOPICS_JSON: " + e.message);
    }
  }

  // Parse admin IDs array
  const adminIds = (props.TELEGRAM_ADMIN_IDS || props.TELEGRAM_CHAT_ID || '')
    .split(',')
    .map(id => id.trim())
    .filter(Boolean);

  return {
    // Secret & Security
    APP_SHARED_SECRET: props.APP_SHARED_SECRET || 'secret_youtube_gas_key_2026',
    TELEGRAM_SECRET_HEADER: props.TELEGRAM_SECRET_HEADER || '',
    TELEGRAM_ADMIN_IDS: adminIds,

    // YouTube Configuration
    YOUTUBE_CHANNEL_ID: props.YOUTUBE_CHANNEL_ID || '',

    // Telegram Configuration
    TELEGRAM_TOKEN: props.TELEGRAM_TOKEN || '',
    TELEGRAM_CHAT_ID: props.TELEGRAM_CHAT_ID || '',
    TELEGRAM_GROUP_CHAT_ID: props.TELEGRAM_GROUP_CHAT_ID || '',
    TELEGRAM_GROUP_CHAT_TOPICS: topics,

    // Database / Google Sheets
    SPREADSHEET_ID: props.SPREADSHEET_ID || '',
    ANALYTICS_SHEET_NAME: props.ANALYTICS_SHEET_NAME || 'Data',
    IDEAS_SHEET_NAME: props.IDEAS_SHEET_NAME || 'Ideas',
  };
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
    APP_SHARED_SECRET: 'secret_youtube_gas_key_2026',
    TELEGRAM_SECRET_HEADER: 'my_telegram_webhook_secret_2026',
    TELEGRAM_ADMIN_IDS: '6685473611',
    YOUTUBE_CHANNEL_ID: 'UCfbflcRHrer8gyyQQpkhFww',
    TELEGRAM_TOKEN: '8844130917:AAGfJ9JHXe5-kbfsewZndjtQ5v77zGOVAsY',
    TELEGRAM_CHAT_ID: '6685473611',
    TELEGRAM_GROUP_CHAT_ID: '-1004387588160',
    TELEGRAM_TOPICS_JSON: JSON.stringify({
      GENERAL: 1,
      NOTIF: 22,
      IDEAS: 26,
      REPORTS: 32
    }),
    SPREADSHEET_ID: '18z3nWha6AlPZj0rfuB98yZvoHC9uNOwuwjVnJDJpe1k',
    ANALYTICS_SHEET_NAME: 'Data',
    IDEAS_SHEET_NAME: 'Ideas'
  };

  PropertiesService.getScriptProperties().setProperties(initialProps, false);
  Logger.log('✅ Script Properties berhasil diinisialisasi:');
  Logger.log(PropertiesService.getScriptProperties().getProperties());
}
