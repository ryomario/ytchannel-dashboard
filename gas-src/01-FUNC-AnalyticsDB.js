// ===================================================
// 1. FUNGSI RECORD HARIAN (Jalankan via Time-driven Trigger)
// ===================================================
function recordDailyStats() {
  try {
    // A. Ambil Data Real-time dari YouTube API
    const channelResponse = YouTube.Channels.list("statistics", { id: CONFIG.YOUTUBE_CHANNEL_ID });
    if (!channelResponse.items || channelResponse.items.length === 0) return;

    const stats = channelResponse.items[0].statistics;
    const currentSubs = Number(stats.subscriberCount);
    const currentViews = Number(stats.viewCount);
    const currentVideos = Number(stats.videoCount);

    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.ANALYTICS_SHEET_NAME);
    const lastRow = sheet.getLastRow();

    const todayDate = Utilities.formatDate(new Date(), "Asia/Jakarta", "yyyy-MM-dd");

    let dailySubsDiff = 0;
    let dailyViewsDiff = 0;

    // B. Hitung Selisih Pertumbuhan Dibanding Hari Kemarin
    if (lastRow > 1) {
      const lastRowData = sheet.getRange(lastRow, 1, 1, 4).getValues()[0];
      const prevDate = Utilities.formatDate(new Date(lastRowData[0]), "Asia/Jakarta", "yyyy-MM-dd");

      // Cek agar tidak menyimpan data ganda pada hari yang sama
      if (prevDate === todayDate) {
        Logger.log("Data hari ini sudah tercatat sebelumnya.");
        return;
      }

      const prevSubs = Number(lastRowData[1]);
      const prevViews = Number(lastRowData[2]);

      dailySubsDiff = currentSubs - prevSubs;
      dailyViewsDiff = currentViews - prevViews;
    }

    // C. Simpan Data Baru ke Baris Terakhir
    sheet.appendRow([
      todayDate,
      currentSubs,
      currentViews,
      currentVideos,
      dailySubsDiff,
      dailyViewsDiff
    ]);

    Logger.log("Record harian berhasil disimpan: " + todayDate);

  } catch (error) {
    Logger.log("Error recordDailyStats: " + error.toString());
  }
}

// ===================================================
// 2. HANDLER COMMAND: /trend
// ===================================================
function handleTrendCommand() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.ANALYTICS_SHEET_NAME);
    const lastRow = sheet.getLastRow();

    // Butuh minimal 2 baris data (Header + 2 record) untuk melihat tren
    if (lastRow <= 2) {
      return (
        `*[ YOUTUBE - GROWTH TREND ]*\n` +
        `🗓 ${getTimeString()}\n` +
        `----------------------------------------\n\n` +
        `⚠️ *DATA BELUM CUKUP*\n` +
        `Sistem membutuhkan minimal 2 hari pencatatan data harian di Google Sheets untuk menampilkan tren pertumbuhan.\n\n` +
        `----------------------------------------\n` +
        `🟡 *Status:* Menunggu Pencatatan Data`
      );
    }

    // Ambil maksimal 7 data terakhir
    const numRowsToFetch = Math.min(lastRow - 1, 7);
    const startRow = lastRow - numRowsToFetch + 1;
    const dataRange = sheet.getRange(startRow, 1, numRowsToFetch, 6).getValues();

    // Data Hari Pertama vs Data Hari Ini
    const oldestEntry = dataRange[0];
    const newestEntry = dataRange[dataRange.length - 1];

    const totalDays = dataRange.length;
    const totalSubsGrowth = Number(newestEntry[1]) - Number(oldestEntry[1]);
    const totalViewsGrowth = Number(newestEntry[2]) - Number(oldestEntry[2]);

    // Rata-rata Pertumbuhan Per Hari
    const avgSubsPerDay = Math.round(totalSubsGrowth / totalDays);
    const avgViewsPerDay = Math.round(totalViewsGrowth / totalDays);

    // Format Pesan Dashboard
    return msgTrendDashboard({
      totalDays: totalDays,
      currentSubs: newestEntry[1],
      totalSubsGrowth: totalSubsGrowth,
      totalViewsGrowth: totalViewsGrowth,
      avgSubsPerDay: avgSubsPerDay,
      avgViewsPerDay: avgViewsPerDay,
      history: dataRange
    });
  } catch (error) {
    return msgError(parseErrorMsg(error));
  }
}

// ===================================================
// 3. TEMPLATE DASHBOARD /trend
// ===================================================
function msgTrendDashboard(data) {
  let historyContent = "";

  // Menampilkan riwayat ringkas 7 hari terakhir
  data.history.reverse().forEach((row) => {
    const dateStr = Utilities.formatDate(new Date(row[0]), "Asia/Jakarta", "dd/MM");
    const subsDiff = row[4] >= 0 ? `+${row[4]}` : `${row[4]}`;
    const viewsDiff = row[5] >= 0 ? `+${Number(row[5]).toLocaleString('id-ID')}` : `${Number(row[5]).toLocaleString('id-ID')}`;

    historyContent += ` • *${dateStr}* : *${subsDiff}* subs │ *${viewsDiff}* views\n`;
  });

  const subsIcon = data.totalSubsGrowth >= 0 ? "📈" : "📉";

  return (
    `*[ YOUTUBE - ${data.totalDays} DAYS GROWTH TREND ]*\n` +
    `🗓 ${getTimeString()}\n` +
    `----------------------------------------\n\n` +
    `${subsIcon} *RINGKASAN ${data.totalDays} HARI TERAKHIR*\n` +
    ` • Pertumbuhan Subs  : *${data.totalSubsGrowth >= 0 ? "+" : ""}${formatNumber(data.totalSubsGrowth)}* subs\n` +
    ` • Total Penambahan Views: *+${formatNumber(data.totalViewsGrowth)}* views\n\n` +
    `📊 *RATA-RATA HARIAN*\n` +
    ` • Subs / Hari       : *+${formatNumber(data.avgSubsPerDay)}* subs\n` +
    ` • Views / Hari      : *+${formatNumber(data.avgViewsPerDay)}* views\n\n` +
    `🗓 *RIWAYAT HARIAN*\n` +
    `${historyContent}\n` +
    `----------------------------------------\n` +
    `🟢 *Status:* Analisis Tren Berhasil`
  );
}