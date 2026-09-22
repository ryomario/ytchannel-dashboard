const CONFIG_NOTIF = {
  SUBS_MILESTONES: [100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000],
}

// ===================================================
// AMBIL JUMLAH SUBSCRIBER DARI YOUTUBE API
// ===================================================
function getSubscriberCount(channelId) {
  try {
    const data = YouTube.Channels.list(['statistics'],{ id: channelId });
    
    if (data.items && data.items.length > 0) {
      const channel = data.items[0];
      const count = channel.statistics.subscriberCount;
      return parseInt(count);
    } else {
      throw new Error("❌ Channel tidak ditemukan. Pastikan ID benar.");
    }
  } catch (e) {
    Logger.log("Error ambil data Subs YouTube: " + parseErrorMsg(e));;
    return null;
  }
}

// FUNGSI UTAMA YANG DIJALANKAN TIAP JAM
function checkSubscribers() {
  const currentCount = getSubscriberCount(CONFIG.YOUTUBE_CHANNEL_ID);
  if (currentCount === null) return;

  const props = PropertiesService.getScriptProperties();
  const lastCount = parseInt(props.getProperty("LAST_SUBSCRIBER_COUNT"));
  const milestones = [...CONFIG_NOTIF.SUBS_MILESTONES];

  if (isNaN(lastCount)) {
    props.setProperty("LAST_SUBSCRIBER_COUNT", currentCount.toString());
    sendTelegram(msgBotStart(currentCount), CONFIG.TELEGRAM_GROUP_CHAT_ID, CONFIG.TELEGRAM_GROUP_CHAT_TOPICS.NOTIF);
    return;
  }

  // Cek apakah melewati milestone
  const crossedMilestone = milestones.find(m => lastCount < m && currentCount >= m);
  if (crossedMilestone) {
    sendTelegram(msgMilestoneReached(crossedMilestone), CONFIG.TELEGRAM_GROUP_CHAT_ID, CONFIG.TELEGRAM_GROUP_CHAT_TOPICS.NOTIF);
  }

  if (currentCount > lastCount) {
    sendTelegram(msgSubscriberUp(currentCount, lastCount), CONFIG.TELEGRAM_GROUP_CHAT_ID, CONFIG.TELEGRAM_GROUP_CHAT_TOPICS.NOTIF);
    props.setProperty("LAST_SUBSCRIBER_COUNT", currentCount.toString());
  } else if (currentCount < lastCount) {
    sendTelegram(msgSubscriberDown(currentCount, lastCount), CONFIG.TELEGRAM_GROUP_CHAT_ID, CONFIG.TELEGRAM_GROUP_CHAT_TOPICS.NOTIF);
    props.setProperty("LAST_SUBSCRIBER_COUNT", currentCount.toString());
  } else {
    Logger.log("Tidak ada perubahan subscriber.");
  }
}

// PESAN: BOT PERTAMA AKTIF
function msgBotStart(currentCount) {
  const milestone = getNextMilestone(currentCount);
  const needed = milestone - currentCount;
  const progress = getProgressBar(currentCount, milestone);

  return (
    `*[ YOUTUBE MONITOR - BOT STARTED ]*\n` +
    `🗓 ${getTimeString()}\n` +
    `----------------------------------------\n\n` +
    `🤖 *STATUS MONITORING*\n` +
    ` • Mode : *Aktif*\n` +
    ` • Interval : *Setiap 1 jam*\n\n` +
    `👥 *SUBSCRIBER STATUS*\n` +
    ` • Saat Ini : *${formatNumber(currentCount)}* subs\n` +
    ` • Target : *${formatNumber(milestone)}* subs\n` +
    ` • Kurang : *${formatNumber(needed)}* subs lagi\n\n` +
    `📊 *PROGRESS TO MILESTONE*\n` +
    ` ${progress}\n\n` +
    `----------------------------------------\n` +
    `🟢 *Status:* Pemantauan Otomatis Dimulai`
  );
}

// PESAN: MILESTONE TERCAPAI 🏆
function msgMilestoneReached(currentCount) {
  const nextMilestone = getNextMilestone(currentCount);
  const needed = nextMilestone - currentCount;

  return (
    `*[ 🏆 MILESTONE TERCAPAI! 🏆 ]*\n` +
    `🗓 ${getTimeString()}\n` +
    `----------------------------------------\n\n` +
    `🥳 *PENCAPAIAN BARU*\n` +
    ` Selamat! Channel kamu baru saja menembus *${formatNumber(currentCount)}* subscribers!\n\n` +
    `🎯 *TARGET SELANJUTNYA*\n` +
    ` • Target Baru : *${formatNumber(nextMilestone)}* subs\n` +
    ` • Kurang : *${formatNumber(needed)}* subs lagi\n\n` +
    `----------------------------------------\n` +
    `🚀 *Status:* Terus berkarya dan raih puncak lebih tinggi!`
  );
}

// PESAN: SUBSCRIBER BERTAMBAH
function msgSubscriberUp(currentCount, lastCount) {
  const newSubs = currentCount - lastCount;
  const milestone = getNextMilestone(currentCount);
  const needed = milestone - currentCount;
  const progress = getProgressBar(currentCount, milestone);

  // Tentukan label/badge berdasarkan jumlah kenaikan
  let badge = "";
  if (newSubs >= 1000) badge = "🔥 LUAR BIASA!";
  else if (newSubs >= 100) badge = "🚀 MANTAP!";
  else if (newSubs >= 10) badge = "⚡ BAGUS!";
  else badge = "🎉 SUBSCRIBER BARU!";

  return (
    `*[ SUBSCRIBER INCREASE - ${badge} ]*\n` +
    `🗓 ${getTimeString()}\n` +
    `----------------------------------------\n\n` +
    `📈 *RINGKASAN PERUBAHAN*\n` +
    ` • Sebelumnya : *${formatNumber(lastCount)}*\n` +
    ` • Sekarang   : *${formatNumber(currentCount)}*\n` +
    ` • Perubahan  : *+${formatNumber(newSubs)}* 🟢\n\n` +
    `🎯 *TARGET MILESTONE*\n` +
    ` • Target     : *${formatNumber(milestone)}*\n` +
    ` • Kurang     : *${formatNumber(needed)}* subs lagi\n\n` +
    `📊 *PROGRESS*\n` +
    ` ${progress}\n\n` +
    `----------------------------------------\n` +
    `💪 *Status:* Terus semangat berkarya!`
  );
}

// PESAN: SUBSCRIBER BERKURANG
function msgSubscriberDown(currentCount, lastCount) {
  const lost = lastCount - currentCount;
  const milestone = getNextMilestone(currentCount);
  const needed = milestone - currentCount;
  const progress = getProgressBar(currentCount, milestone);

  return (
    `*[ ALERT - SUBSCRIBER DECREASE ]*\n` +
    `🗓 ${getTimeString()}\n` +
    `----------------------------------------\n\n` +
    `📉 *RINGKASAN PERUBAHAN*\n` +
    ` • Sebelumnya : *${formatNumber(lastCount)}*\n` +
    ` • Sekarang   : *${formatNumber(currentCount)}*\n` +
    ` • Perubahan  : *-${formatNumber(lost)}* 🔴\n\n` +
    `🎯 *TARGET MILESTONE*\n` +
    ` • Target     : *${formatNumber(milestone)}*\n` +
    ` • Kurang     : *${formatNumber(needed)}* subs lagi\n\n` +
    `📊 *PROGRESS*\n` +
    ` ${progress}\n\n` +
    `----------------------------------------\n` +
    `💡 *Status:* Jangan menyerah, evaluasi & terus buat konten!`
  );
}

// Fungsi helper: hitung milestone berikutnya
function getNextMilestone(count) {
  const milestones = [...CONFIG_NOTIF.SUBS_MILESTONES];
  for (const m of milestones) {
    if (count < m) return m;
  }
  return null;
}

// Fungsi helper: progress bar milestone
function getProgressBar(current, target) {
  const percent = Math.min((current / target) * 100, 100);
  const filled = Math.round(percent / 10);
  const empty = 10 - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  return `${bar} ${percent.toFixed(1)}%`;
}

// ===================================================
// AMBIL DATA REVENUE - Pakai built-in YouTube Analytics
// ===================================================
function getRevenueData(channelId) {
  const today = new Date();
  const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
  const format = d => d.toISOString().slice(0, 10);

  try {
    const data = YouTubeAnalytics.Reports.query({
      ids: `channel==${channelId}`,
      startDate: format(startDate),
      endDate: format(today),
      metrics: "estimatedRevenue,cpm,views,estimatedMinutesWatched",
      dimensions: "day",
      sort: "day"
    });

    if (!data || !data.rows || data.rows.length === 0) return null;

    const todayStr = new Date().toISOString().slice(0, 10);
    const headers = data.columnHeaders.map(h => h.name);

    let totalRevenue = 0, totalViews = 0, totalMinutes = 0;
    let todayRevenue = 0, todayViews = 0, lastCpm = 0;
    let firstDate = data.rows[0][0], lastDate = todayStr;

    data.rows.forEach(row => {
      const rowDate  = row[0];
      const revenue  = parseFloat(row[headers.indexOf("estimatedRevenue")] || 0);
      const views    = parseInt(row[headers.indexOf("views")] || 0);
      const minutes  = parseInt(row[headers.indexOf("estimatedMinutesWatched")] || 0);
      const cpm      = parseFloat(row[headers.indexOf("cpm")] || 0);

      totalRevenue  += revenue;
      totalViews    += views;
      totalMinutes  += minutes;
      lastCpm        = cpm;

      lastDate = rowDate;

      if (rowDate === todayStr) {
        todayRevenue = revenue;
        todayViews   = views;
      }
    });

    return { totalRevenue, totalViews, totalMinutes, todayRevenue, todayViews, lastCpm, firstDate, lastDate };
  } catch (e) {
    Logger.log("Error revenue: " + parseErrorMsg(e));
    return null;
  }
}

// FUNGSI UTAMA YANG DIJALANKAN TIAP HARI
function sendDailyReport() {
  const subs = getSubscriberCount(CONFIG.YOUTUBE_CHANNEL_ID);
  const rev  = getRevenueData(CONFIG.YOUTUBE_CHANNEL_ID);

  if (!subs || !rev) {
    sendTelegram(msgError("⚠️ Gagal mengambil data. Cek log Apps Script.", 'Error eksekusi fungsi "sendDailyReport"'));
    return;
  }

  sendTelegram(msgDailyReport(subs, rev), CONFIG.TELEGRAM_GROUP_CHAT_ID, CONFIG.TELEGRAM_GROUP_CHAT_TOPICS.REPORTS);
}

// PESAN: LAPORAN HARIAN
function msgDailyReport(subs, rev) {
  const monthName = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
  const bulan = monthName[new Date().getMonth()];

  return (
    `*[ YOUTUBE DAILY ANALYTICS REPORT ]*\n` +
    `🗓 ${getTimeString(rev.firstDate, false)} - ${getTimeString(rev.lastDate, false)}\n` +
    `----------------------------------------\n\n` +
    `👥 *SUBSCRIBER TOTAL*\n` +
    ` • Total Subs : *${formatNumber(subs)}*\n\n` +
    `💵 *ESTIMASI PENGHASILAN*\n` +
    ` • Hari Ini : *${formatUSD(rev.todayRevenue)}*\n` +
    ` • Bulan ${bulan} : *${formatUSD(rev.totalRevenue)}*\n` +
    ` • CPM Terakhir : *${formatUSD(rev.lastCpm)}*\n\n` +
    `📈 *STATISTIK PENONTON*\n` +
    ` • Views Hari Ini : *${formatNumber(rev.todayViews)}*\n` +
    ` • Views Bulan ${bulan} : *${formatNumber(rev.totalViews)}*\n` +
    ` • Menit Ditonton : *${formatNumber(rev.totalMinutes)}* mnt\n\n` +
    `----------------------------------------\n` +
    `🤖 *Source:* YouTube Analytics API`
  );
}