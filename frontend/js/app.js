/**
 * ===================================================
 * YOUTUBE CHANNEL OBSERVER & MANAGER — FRONTEND APP
 * ===================================================
 */

const state = {
  channel: null,
  latestVideos: [],
  topVideos: [],
  ideas: [],
  rawGrowthData: null,
  growthData: null,
  growthPeriod: 'all', // 'all' | '30d' | 'this_month' | '7d'
  activeIdeaStatusFilter: 'ALL', // 'ALL' | 'DRAFT' | 'IN_PROGRESS' | 'DONE' | 'ARCHIVED'
  activeIdeaPriorityFilter: 'ALL', // 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'
  ideaSearchQuery: '',
  undoQueue: null
};

let growthChartInstance = null;
let growthAnimationTimer = null;
const tg = window.Telegram ? window.Telegram.WebApp : null;

// ==========================================
// INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initTelegramApp();
  setupEventListeners();

  // Jalankan alur inisialisasi autentikasi
  initAuth((token) => {
    refreshDashboardData();
  });
});

function initTelegramApp() {
  if (typeof TMAHelper !== 'undefined') {
    TMAHelper.initApp();
  } else if (tg) {
    try {
      tg.ready();
      tg.expand();
      if (tg.setHeaderColor) tg.setHeaderColor('#0f172a');
      if (tg.setBackgroundColor) tg.setBackgroundColor('#0f172a');
    } catch (e) {
      console.warn("Telegram WebApp initialization warning:", e);
    }
  }
}

function triggerHaptic(style = 'light') {
  if (typeof TMAHelper !== 'undefined') {
    if (style === 'selection') {
      TMAHelper.triggerHaptic('selection');
    } else {
      TMAHelper.triggerHaptic('impact', style);
    }
    return;
  }
  if (tg && tg.HapticFeedback) {
    try {
      if (style === 'selection') {
        tg.HapticFeedback.selectionChanged();
      } else {
        tg.HapticFeedback.impactOccurred(style);
      }
    } catch (e) {
      console.warn("Haptic feedback error:", e);
    }
  }
}

function setupEventListeners() {
  // Modal password input keypress (Enter)
  const passwordInput = document.getElementById('passwordInput');
  if (passwordInput) {
    passwordInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        processPasswordSubmit();
      }
    });
  }

  // Tombol submit modal password
  const modalSubmitBtn = document.getElementById('modalSubmitBtn');
  if (modalSubmitBtn) {
    modalSubmitBtn.addEventListener('click', () => {
      processPasswordSubmit();
    });
  }

  // Tombol retry di layar unauthorized
  const unauthorizedRetryBtn = document.getElementById('unauthorizedRetryBtn');
  if (unauthorizedRetryBtn) {
    unauthorizedRetryBtn.addEventListener('click', () => {
      showPasswordModal();
    });
  }

  // Keyboard shortcut: Escape untuk menutup modal
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeIdeaModal();
    }
  });
}

/**
 * Memproses submit password dengan animasi loading di tombol
 * dan validasi server sebelum menutup modal
 */
async function processPasswordSubmit() {
  const input = document.getElementById('passwordInput');
  const val = input ? input.value.trim() : '';
  const errorEl = document.getElementById('modalError');
  const btn = document.getElementById('modalSubmitBtn');

  if (!val) {
    if (errorEl) {
      errorEl.textContent = 'Silakan masukkan kata sandi rahasia.';
      errorEl.style.display = 'block';
    }
    return;
  }

  if (errorEl) errorEl.style.display = 'none';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="btn-spinner"></span> Memverifikasi...';
  }

  setAuthToken(val);

  try {
    const res = await callApi('getDashboardData');
    if (res && res.success) {
      hidePasswordModal();
      hideUnauthorizedScreen();
      handleDashboardDataSuccess(res);
      showToast("Berhasil terautentikasi!", "success");
    } else {
      clearAuthToken();
      if (errorEl) {
        errorEl.textContent = (res && res.error) ? res.error : 'Kunci rahasia salah. Silakan coba lagi.';
        errorEl.style.display = 'block';
      }
      if (input) input.select();
    }
  } catch (err) {
    clearAuthToken();
    if (errorEl) {
      errorEl.textContent = 'Autentikasi gagal: ' + (err.message || 'Kunci rahasia salah.');
      errorEl.style.display = 'block';
    }
    if (input) input.select();
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'Masuk ke Dashboard';
    }
  }
}

// ==========================================
// TAB NAVIGATION CONTROLLER
// ==========================================
function switchTab(tabName) {
  triggerHaptic('selection');

  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => item.classList.remove('active'));

  const targetNav = document.getElementById('nav-' + tabName);
  if (targetNav) targetNav.classList.add('active');

  const panes = document.querySelectorAll('.tab-pane');
  panes.forEach(pane => pane.classList.remove('active'));

  const targetPane = document.getElementById('tab-' + tabName);
  if (targetPane) targetPane.classList.add('active');

  if (tabName === 'ideas') {
    if (typeof TMAHelper !== 'undefined') {
      TMAHelper.showMainButton("+ Tambah Ide Baru", openCreateIdeaModal);
    }
  } else {
    if (typeof TMAHelper !== 'undefined') {
      TMAHelper.hideMainButton();
    }
  }
}

// ==========================================
// DATA FETCHING & API INTEGRATION
// ==========================================
async function refreshDashboardData(forceRefresh = false) {
  triggerHaptic('light');
  showLoadingSkeletons();

  const btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) btnRefresh.classList.add('spinning');

  try {
    const res = await callApi('getDashboardData', { forceRefresh: forceRefresh });
    handleDashboardDataSuccess(res);
  } catch (err) {
    handleDashboardDataError(err);
  }
}

function handleDashboardDataSuccess(res) {
  const btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) btnRefresh.classList.remove('spinning');

  if (!res || !res.success) {
    console.error("Dashboard API Error:", res ? res.error : "Unknown error");
    showToast(res && res.error ? res.error : "Gagal memuat data", "error");
    return;
  }

  state.channel = res.channel;
  state.latestVideos = res.latestVideos || [];
  state.topVideos = res.topVideos || [];
  state.ideas = (res.ideas || []).map(normalizeIdeaItem).filter(Boolean);
  state.rawGrowthData = res.growthData || null;
  state.growthData = getFilteredGrowthData(state.growthPeriod);

  const periodSelect = document.getElementById('chartPeriodSelect');
  if (periodSelect) periodSelect.value = state.growthPeriod;

  renderHeader();
  renderKPICards();
  renderGrowthChart();
  renderVideoLists();
  renderIdeas();
}

function handleDashboardDataError(err) {
  console.error("Failed to fetch dashboard data:", err);
  const btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) btnRefresh.classList.remove('spinning');
  showToast(err.message || "Gagal menghubungi server", "error");
}

function showLoadingSkeletons() {
  document.getElementById('kpiSubs').innerText = '...';
  document.getElementById('kpiViews').innerText = '...';
  document.getElementById('kpiVideos').innerText = '...';
  const subsDiffEl = document.getElementById('chartSubsDiff');
  const viewsDiffEl = document.getElementById('chartViewsDiff');
  if (subsDiffEl) subsDiffEl.innerText = '...';
  if (viewsDiffEl) viewsDiffEl.innerText = '...';

  if (growthAnimationTimer) {
    clearInterval(growthAnimationTimer);
    growthAnimationTimer = null;
  }

  state.growthData = null;
  state.rawGrowthData = null;
  if (growthChartInstance) {
    growthChartInstance.destroy();
    growthChartInstance = null;
  }

  // 1. Skeleton untuk Channel Growth Chart
  const chartSkeleton = document.getElementById('chartSkeleton');
  if (chartSkeleton) chartSkeleton.classList.add('active');

  const chartCanvas = document.getElementById('growthChart');
  if (chartCanvas) chartCanvas.style.display = 'none';

  // 2. Skeletons untuk Latest Uploads di Dashboard
  const dashListEl = document.getElementById('dashVideoList');
  if (dashListEl) {
    dashListEl.innerHTML = `
      <div class="video-card skeleton" style="height: 82px;"></div>
      <div class="video-card skeleton" style="height: 82px;"></div>
      <div class="video-card skeleton" style="height: 82px;"></div>
    `;
  }

  // 3. Skeletons untuk Top Videos di Tab Videos
  const fullListEl = document.getElementById('fullVideoList');
  if (fullListEl) {
    fullListEl.innerHTML = `
      <div class="video-card skeleton" style="height: 82px;"></div>
      <div class="video-card skeleton" style="height: 82px;"></div>
      <div class="video-card skeleton" style="height: 82px;"></div>
      <div class="video-card skeleton" style="height: 82px;"></div>
      <div class="video-card skeleton" style="height: 82px;"></div>
    `;
  }

  // 4. Skeletons untuk Ideas di Tab Ideas
  const ideaContainer = document.getElementById('ideaContainer');
  if (ideaContainer) {
    ideaContainer.innerHTML = `
      <div class="idea-card skeleton" style="height: 52px;"></div>
      <div class="idea-card skeleton" style="height: 52px;"></div>
      <div class="idea-card skeleton" style="height: 52px;"></div>
    `;
  }
}

// ==========================================
// RENDER FUNCTIONS
// ==========================================
function renderHeader() {
  if (!state.channel) return;
  const titleEl = document.getElementById('channelTitle');
  const handleEl = document.getElementById('channelHandle');
  const avatarEl = document.getElementById('channelAvatar');

  if (titleEl) titleEl.innerText = state.channel.title || 'YouTube Channel';
  if (handleEl) handleEl.innerText = state.channel.customUrl || '@channel';
  if (avatarEl && state.channel.avatarUrl) avatarEl.src = state.channel.avatarUrl;
}

function renderKPICards() {
  if (!state.channel) return;
  document.getElementById('kpiSubs').innerText = formatCompactNumber(state.channel.subscriberCount || 0);
  document.getElementById('kpiViews').innerText = formatCompactNumber(state.channel.viewCount || 0);
  document.getElementById('kpiVideos').innerText = formatNumberWithCommas(state.channel.videoCount || 0);
}

// ==========================================
// GROWTH CHART FILTER & PERIOD HANDLER
// ==========================================
function getFilteredGrowthData(period = 'all') {
  if (!state.rawGrowthData || !state.rawGrowthData.days || state.rawGrowthData.days.length === 0) {
    return state.rawGrowthData;
  }

  const raw = state.rawGrowthData;
  const total = raw.days.length;
  if (total <= 1 || period === 'all') {
    return raw;
  }

  let startIndex = 0;
  const now = new Date();

  if (period === '7d') {
    startIndex = Math.max(0, total - 7);
  } else if (period === '30d') {
    startIndex = Math.max(0, total - 30);
  } else if (period === 'this_month') {
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    let firstIdx = -1;
    for (let i = 0; i < total; i++) {
      let d = null;
      if (raw.timestamps && raw.timestamps[i]) {
        d = new Date(raw.timestamps[i]);
      } else if (raw.isoDates && raw.isoDates[i]) {
        d = new Date(raw.isoDates[i]);
      } else if (raw.fullDates && raw.fullDates[i]) {
        d = new Date(raw.fullDates[i]);
      }
      if (d && !isNaN(d.getTime())) {
        if (d.getFullYear() === curYear && d.getMonth() === curMonth) {
          firstIdx = i;
          break;
        }
      }
    }
    if (firstIdx !== -1) {
      startIndex = firstIdx;
    } else {
      startIndex = Math.max(0, total - 30);
    }
  }

  const slicedDays = raw.days.slice(startIndex);
  const slicedFullDates = raw.fullDates ? raw.fullDates.slice(startIndex) : [];
  const slicedSubs = raw.subscribers ? raw.subscribers.slice(startIndex) : [];
  const slicedViews = raw.views ? raw.views.slice(startIndex) : [];
  const slicedSubsDiffs = raw.subsDiffs ? raw.subsDiffs.slice(startIndex) : [];
  const slicedViewsDiffs = raw.viewsDiffs ? raw.viewsDiffs.slice(startIndex) : [];

  const baseSubs = slicedSubs.length > 0 ? slicedSubs[0] : 0;
  const baseViews = slicedViews.length > 0 ? slicedViews[0] : 0;

  const subsPercentages = slicedSubs.map(s => (baseSubs > 0 ? Number((((s - baseSubs) / baseSubs) * 100).toFixed(2)) : 0));
  const viewsPercentages = slicedViews.map(v => (baseViews > 0 ? Number((((v - baseViews) / baseViews) * 100).toFixed(2)) : 0));

  const totalSubsGrowth = slicedSubs.length > 1 ? (slicedSubs[slicedSubs.length - 1] - slicedSubs[0]) : (slicedSubsDiffs[0] || 0);
  const totalViewsGrowth = slicedViews.length > 1 ? (slicedViews[slicedViews.length - 1] - slicedViews[0]) : (slicedViewsDiffs[0] || 0);
  const totalSubsPctGrowth = subsPercentages.length > 0 ? subsPercentages[subsPercentages.length - 1] : 0;
  const totalViewsPctGrowth = viewsPercentages.length > 0 ? viewsPercentages[viewsPercentages.length - 1] : 0;

  return {
    days: slicedDays,
    fullDates: slicedFullDates,
    subscribers: slicedSubs,
    views: slicedViews,
    subsPercentages: subsPercentages,
    viewsPercentages: viewsPercentages,
    subsDiffs: slicedSubsDiffs,
    viewsDiffs: slicedViewsDiffs,
    subsGrowth: totalSubsGrowth,
    viewsGrowth: totalViewsGrowth,
    totalSubsPctGrowth: totalSubsPctGrowth,
    totalViewsPctGrowth: totalViewsPctGrowth,
    totalRecords: slicedDays.length
  };
}

function handlePeriodChange(newPeriod) {
  state.growthPeriod = newPeriod;
  if (!state.rawGrowthData) return;

  if (growthAnimationTimer) {
    clearInterval(growthAnimationTimer);
    growthAnimationTimer = null;
  }

  const chartSkeleton = document.getElementById('chartSkeleton');
  const chartCanvas = document.getElementById('growthChart');

  if (chartSkeleton && chartCanvas) {
    chartSkeleton.classList.add('active');
    chartCanvas.style.display = 'none';

    setTimeout(() => {
      chartSkeleton.classList.remove('active');
      chartCanvas.style.display = 'block';
      state.growthData = getFilteredGrowthData(newPeriod);
      renderGrowthChart();
    }, 220);
  } else {
    state.growthData = getFilteredGrowthData(newPeriod);
    renderGrowthChart();
  }
}
window.handlePeriodChange = handlePeriodChange;

function renderGrowthChart() {
  const chartCanvas = document.getElementById('growthChart');
  if (!chartCanvas || !state.growthData) return;

  const data = state.growthData;
  const subsDiffEl = document.getElementById('chartSubsDiff');
  const viewsDiffEl = document.getElementById('chartViewsDiff');

  const finalSubsPct = data.totalSubsPctGrowth !== undefined
    ? data.totalSubsPctGrowth
    : (data.subsPercentages && data.subsPercentages.length ? data.subsPercentages[data.subsPercentages.length - 1] : 0);
  const finalViewsPct = data.totalViewsPctGrowth !== undefined
    ? data.totalViewsPctGrowth
    : (data.viewsPercentages && data.viewsPercentages.length ? data.viewsPercentages[data.viewsPercentages.length - 1] : 0);

  if (typeof Chart === 'undefined') {
    setTimeout(renderGrowthChart, 250);
    return;
  }

  const chartSkeleton = document.getElementById('chartSkeleton');
  if (chartSkeleton) chartSkeleton.classList.remove('active');
  if (chartCanvas) chartCanvas.style.display = 'block';

  if (growthAnimationTimer) {
    clearInterval(growthAnimationTimer);
    growthAnimationTimer = null;
  }

  if (growthChartInstance) {
    growthChartInstance.destroy();
    growthChartInstance = null;
  }

  const ctx = chartCanvas.getContext('2d');

  const gradSubs = ctx.createLinearGradient(0, 0, 0, 190);
  gradSubs.addColorStop(0, 'rgba(255, 68, 68, 0.32)');
  gradSubs.addColorStop(1, 'rgba(255, 68, 68, 0.00)');

  const gradViews = ctx.createLinearGradient(0, 0, 0, 190);
  gradViews.addColorStop(0, 'rgba(42, 171, 238, 0.32)');
  gradViews.addColorStop(1, 'rgba(42, 171, 238, 0.00)');

  const totalPoints = data.days && data.days.length ? data.days.length : 0;
  if (totalPoints === 0) return;

  const initialDays = [data.days[0]];
  const initialSubsData = [data.subsPercentages ? data.subsPercentages[0] : 0];
  const initialViewsData = [data.viewsPercentages ? data.viewsPercentages[0] : 0];

  if (subsDiffEl) subsDiffEl.innerText = (initialSubsData[0] >= 0 ? '+' : '') + Number(initialSubsData[0]).toFixed(2) + '%';
  if (viewsDiffEl) viewsDiffEl.innerText = (initialViewsData[0] >= 0 ? '+' : '') + Number(initialViewsData[0]).toFixed(2) + '%';

  growthChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: initialDays,
      datasets: [
        {
          label: 'Subscribers',
          data: initialSubsData,
          borderColor: '#ff4444',
          backgroundColor: gradSubs,
          borderWidth: 2.5,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#ff4444',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHitRadius: 12
        },
        {
          label: 'Views',
          data: initialViewsData,
          borderColor: '#2aabee',
          backgroundColor: gradViews,
          borderWidth: 2.5,
          fill: true,
          tension: 0.35,
          pointBackgroundColor: '#2aabee',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointHitRadius: 12
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(15, 23, 42, 0.94)',
          titleColor: '#f8fafc',
          bodyColor: '#cbd5e1',
          borderColor: 'rgba(255, 255, 255, 0.15)',
          borderWidth: 1,
          padding: 10,
          boxPadding: 4,
          usePointStyle: true,
          callbacks: {
            title: function (items) {
              if (!items || !items.length) return '';
              const idx = items[0].dataIndex;
              return (data.fullDates && data.fullDates[idx]) ? data.fullDates[idx] : data.days[idx];
            },
            label: function (context) {
              const idx = context.dataIndex;
              const isSubs = context.datasetIndex === 0;
              const pctVal = context.parsed.y;
              const pctStr = (pctVal >= 0 ? '+' : '') + Number(pctVal).toFixed(2) + '%';

              if (isSubs) {
                const count = data.subscribers && data.subscribers[idx] ? formatCompactNumber(data.subscribers[idx]) : '';
                const diff = data.subsDiffs && data.subsDiffs[idx] !== undefined ? ` (+${formatCompactNumber(data.subsDiffs[idx])})` : '';
                return ` Subs: ${pctStr} • ${count}${diff}`;
              } else {
                const count = data.views && data.views[idx] ? formatCompactNumber(data.views[idx]) : '';
                const diff = data.viewsDiffs && data.viewsDiffs[idx] !== undefined ? ` (+${formatCompactNumber(data.viewsDiffs[idx])})` : '';
                return ` Views: ${pctStr} • ${count}${diff}`;
              }
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: 'rgba(255, 255, 255, 0.04)',
            drawBorder: false
          },
          ticks: {
            color: '#94a3b8',
            autoSkip: true,
            maxTicksLimit: 8,
            font: {
              size: 10.5,
              weight: '500'
            }
          }
        },
        y: {
          type: 'linear',
          grid: {
            color: 'rgba(255, 255, 255, 0.04)',
            drawBorder: false
          },
          ticks: {
            display: false
          }
        }
      }
    }
  });

  if (totalPoints > 1) {
    const maxTotalDurationMs = 30000;
    const targetDurationMs = Math.min(maxTotalDurationMs, Math.max(1200, (totalPoints - 1) * 120));
    const stepIntervalMs = Math.max(20, Math.floor(targetDurationMs / (totalPoints - 1)));

    let currentIdx = 0;
    growthAnimationTimer = setInterval(() => {
      currentIdx++;
      if (currentIdx < totalPoints) {
        growthChartInstance.data.labels.push(data.days[currentIdx]);
        growthChartInstance.data.datasets[0].data.push(data.subsPercentages ? data.subsPercentages[currentIdx] : 0);
        growthChartInstance.data.datasets[1].data.push(data.viewsPercentages ? data.viewsPercentages[currentIdx] : 0);

        const curSubsPct = data.subsPercentages ? data.subsPercentages[currentIdx] : 0;
        const curViewsPct = data.viewsPercentages ? data.viewsPercentages[currentIdx] : 0;
        if (subsDiffEl) subsDiffEl.innerText = (curSubsPct >= 0 ? '+' : '') + Number(curSubsPct).toFixed(2) + '%';
        if (viewsDiffEl) viewsDiffEl.innerText = (curViewsPct >= 0 ? '+' : '') + Number(curViewsPct).toFixed(2) + '%';

        growthChartInstance.update({
          duration: Math.min(stepIntervalMs, 80),
          easing: 'easeOutQuad'
        });
      } else {
        clearInterval(growthAnimationTimer);
        growthAnimationTimer = null;
        if (subsDiffEl) subsDiffEl.innerText = (finalSubsPct >= 0 ? '+' : '') + Number(finalSubsPct).toFixed(2) + '%';
        if (viewsDiffEl) viewsDiffEl.innerText = (finalViewsPct >= 0 ? '+' : '') + Number(finalViewsPct).toFixed(2) + '%';
      }
    }, stepIntervalMs);
  } else {
    if (subsDiffEl) subsDiffEl.innerText = (finalSubsPct >= 0 ? '+' : '') + Number(finalSubsPct).toFixed(2) + '%';
    if (viewsDiffEl) viewsDiffEl.innerText = (finalViewsPct >= 0 ? '+' : '') + Number(finalViewsPct).toFixed(2) + '%';
  }
}

function renderVideoLists() {
  const dashListEl = document.getElementById('dashVideoList');
  const fullListEl = document.getElementById('fullVideoList');

  // Tab 1: Latest Uploads
  if (dashListEl) {
    if (!state.latestVideos || state.latestVideos.length === 0) {
      dashListEl.innerHTML = `<div class="empty-state"><p>Belum ada video yang diupload.</p></div>`;
    } else {
      dashListEl.innerHTML = state.latestVideos.map(video => buildVideoCardHtml(video)).join('');
    }
  }

  // Tab 2: Top 5 Most Viewed Videos
  if (fullListEl) {
    let topVids = state.topVideos || [];
    if (topVids.length === 0 && state.latestVideos && state.latestVideos.length > 0) {
      topVids = [...state.latestVideos].sort((a, b) => (b.viewCount || 0) - (a.viewCount || 0));
    }
    topVids = topVids.slice(0, 5);

    if (topVids.length === 0) {
      fullListEl.innerHTML = `<div class="empty-state"><p>Tidak ada data video.</p></div>`;
    } else {
      fullListEl.innerHTML = topVids.map((video, idx) => buildVideoCardHtml(video, idx + 1)).join('');
    }
  }
}

function buildVideoCardHtml(video, rank) {
  const formattedViews = formatCompactNumber(video.viewCount || 0);
  const formattedLikes = formatCompactNumber(video.likeCount || 0);
  const formattedComments = formatCompactNumber(video.commentCount || 0);
  const relativeTime = getRelativeTimeString(video.publishedAt);
  const rankHtml = rank ? `<div class="rank-badge">#${rank}</div>` : '';

  return `
    <div class="video-card" onclick="openVideoLink('${video.videoUrl}')">
      <div class="video-thumb-wrapper">
        ${rankHtml}
        <img src="${video.thumbnailUrl}" alt="Thumbnail" class="video-thumb" loading="lazy">
        <div class="play-badge">
          <svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
        </div>
      </div>
      <div class="video-info">
        <div class="video-title">${escapeHtml(video.title)}</div>
        <div class="video-meta-row">
          <div class="video-stats-pills">
            <span class="stat-pill views">
              <svg viewBox="0 0 24 24"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
              ${formattedViews}
            </span>
            <span class="stat-pill">
              <svg viewBox="0 0 24 24"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>
              ${formattedLikes}
            </span>
            <span class="stat-pill">
              <svg viewBox="0 0 24 24"><path d="M21.99 4c0-1.1-.89-2-1.99-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18z"/></svg>
              ${formattedComments}
            </span>
          </div>
          <span>${relativeTime}</span>
        </div>
      </div>
    </div>
  `;
}

function openVideoLink(url) {
  triggerHaptic('medium');
  if (tg && tg.openLink) {
    tg.openLink(url);
  } else {
    window.open(url, '_blank');
  }
}

// ==========================================
// ADVANCED CONTENT PLANNER / IDEAS MODULE
// ==========================================

function normalizeIdeaItem(i) {
  if (!i) return null;
  const title = i.title || i.text || '';
  const desc = i.description || '';
  const cat = i.category || 'General';
  const priority = (i.priority || 'MEDIUM').toUpperCase();
  let status = (i.status || '').toUpperCase();
  if (!status || status === 'PENDING') status = 'DRAFT';
  if (status === 'COMPLETED') status = 'DONE';
  return {
    id: String(i.id),
    title: title,
    description: desc,
    category: cat,
    priority: priority,
    status: status,
    is_deleted: Boolean(i.is_deleted),
    created_at: i.created_at || i.createdAt || new Date().toISOString(),
    updated_at: i.updated_at || new Date().toISOString()
  };
}

function setIdeaStatusFilter(status) {
  if (typeof TMAHelper !== 'undefined') {
    TMAHelper.triggerHaptic('selection');
  } else {
    triggerHaptic('selection');
  }

  state.activeIdeaStatusFilter = status;

  const statusList = ['ALL', 'DRAFT', 'IN_PROGRESS', 'DONE', 'ARCHIVED'];
  statusList.forEach(s => {
    const el = document.getElementById('filterStatus' + (s === 'ALL' ? 'All' : (s === 'IN_PROGRESS' ? 'InProgress' : (s.charAt(0) + s.slice(1).toLowerCase()))));
    if (el) el.classList.toggle('active', s === status);
  });

  renderIdeas();
}

function setIdeaPriorityFilter(priority) {
  if (typeof TMAHelper !== 'undefined') {
    TMAHelper.triggerHaptic('selection');
  } else {
    triggerHaptic('selection');
  }

  state.activeIdeaPriorityFilter = priority;

  const priorities = ['ALL', 'HIGH', 'MEDIUM', 'LOW'];
  priorities.forEach(p => {
    const el = document.getElementById('filterPriority' + (p === 'ALL' ? 'All' : (p.charAt(0) + p.slice(1).toLowerCase())));
    if (el) el.classList.toggle('active', p === priority);
  });

  renderIdeas();
}

function handleIdeaSearch(e) {
  state.ideaSearchQuery = (e && e.target ? e.target.value : '').trim().toLowerCase();
  renderIdeas();
}

function renderIdeas() {
  const container = document.getElementById('ideaContainer');
  if (!container) return;

  const allActive = state.ideas.filter(i => !i.is_deleted);

  // Perbarui indikator jumlah badge status
  const countAll = allActive.length;
  const countDraft = allActive.filter(i => i.status === 'DRAFT').length;
  const countInProgress = allActive.filter(i => i.status === 'IN_PROGRESS').length;
  const countDone = allActive.filter(i => i.status === 'DONE').length;
  const countArchived = allActive.filter(i => i.status === 'ARCHIVED').length;

  const countAllEl = document.getElementById('countStatusAll');
  if (countAllEl) countAllEl.innerText = countAll;
  const countDraftEl = document.getElementById('countStatusDraft');
  if (countDraftEl) countDraftEl.innerText = countDraft;
  const countProgressEl = document.getElementById('countStatusInProgress');
  if (countProgressEl) countProgressEl.innerText = countInProgress;
  const countDoneEl = document.getElementById('countStatusDone');
  if (countDoneEl) countDoneEl.innerText = countDone;
  const countArchivedEl = document.getElementById('countStatusArchived');
  if (countArchivedEl) countArchivedEl.innerText = countArchived;

  // Filter daftar berdasarkan Status, Prioritas, dan Pencarian
  let displayList = allActive;

  if (state.activeIdeaStatusFilter !== 'ALL') {
    displayList = displayList.filter(i => i.status === state.activeIdeaStatusFilter);
  }

  if (state.activeIdeaPriorityFilter !== 'ALL') {
    displayList = displayList.filter(i => i.priority === state.activeIdeaPriorityFilter);
  }

  if (state.ideaSearchQuery) {
    const q = state.ideaSearchQuery;
    displayList = displayList.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      i.category.toLowerCase().includes(q)
    );
  }

  if (displayList.length === 0) {
    let emptyMessage = "Belum ada ide yang sesuai dengan filter.";
    if (state.ideaSearchQuery) {
      emptyMessage = `Tidak ada ide yang cocok dengan pencarian "${escapeHtml(state.ideaSearchQuery)}".`;
    } else if (state.activeIdeaStatusFilter === 'ALL' && countAll === 0) {
      emptyMessage = "Belum ada ide konten tersimpan. Klik '+ Ide Baru' untuk mulai mencatat!";
    }

    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/></svg>
        <p>${emptyMessage}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = displayList.map(idea => {
    const isDone = idea.status === 'DONE';
    const isProgress = idea.status === 'IN_PROGRESS';
    const isArchived = idea.status === 'ARCHIVED';

    const priorityClass = idea.priority === 'HIGH' ? 'priority-high' : (idea.priority === 'LOW' ? 'priority-low' : 'priority-medium');
    const priorityLabel = idea.priority === 'HIGH' ? 'High' : (idea.priority === 'LOW' ? 'Low' : 'Medium');

    const statusBadgeClass = isDone ? 'status-done' : (isProgress ? 'status-progress' : (isArchived ? 'status-archived' : 'status-draft'));
    const statusLabel = isDone ? 'Done' : (isProgress ? 'In Progress' : (isArchived ? 'Archived' : 'Draft'));

    return `
      <div class="idea-card ${isDone ? 'completed' : ''}" id="card_${idea.id}">
        <div class="idea-card-header">
          <button class="idea-checkbox-btn ${isDone ? 'checked' : ''}" title="Klik untuk toggle status" onclick="toggleIdeaStatus('${idea.id}')">
            <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          </button>
          <div class="idea-title-wrap">
            <h4 class="idea-card-title">${escapeHtml(idea.title)}</h4>
          </div>
          <div class="idea-card-actions">
            <button class="btn-card-action btn-edit" title="Edit Ide" onclick="openEditIdeaModal('${idea.id}')">
              <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
            </button>
            <button class="btn-card-action btn-delete" title="Hapus Ide" onclick="promptDeleteIdea('${idea.id}')">
              <svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            </button>
          </div>
        </div>

        ${idea.description ? `<p class="idea-card-desc">${escapeHtml(idea.description)}</p>` : ''}

        <div class="idea-card-footer">
          <div class="idea-badges">
            <span class="idea-category-tag">🏷️ ${escapeHtml(idea.category || 'General')}</span>
            <span class="badge-priority ${priorityClass}">⚡ ${priorityLabel}</span>
            <span class="badge-status ${statusBadgeClass}">${statusLabel}</span>
          </div>
          <span class="idea-time">${getTimeElapsed(idea.created_at)}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ------------------------------------------
// MODAL CREATE & EDIT HANDLERS
// ------------------------------------------

function openCreateIdeaModal() {
  if (typeof TMAHelper !== 'undefined') {
    TMAHelper.triggerHaptic('impact', 'light');
    TMAHelper.showBackButton(closeIdeaModal);
    TMAHelper.hideMainButton();
  }

  document.getElementById('ideaModalTitle').innerText = 'Tambah Ide Baru';
  document.getElementById('ideaFormId').value = '';
  document.getElementById('ideaFormTitle').value = '';
  document.getElementById('ideaFormDesc').value = '';
  document.getElementById('ideaFormCategory').value = 'General';
  document.getElementById('ideaFormPriority').value = 'MEDIUM';
  document.getElementById('ideaFormStatus').value = 'DRAFT';

  const errEl = document.getElementById('ideaFormError');
  if (errEl) errEl.style.display = 'none';

  updateTitleCharCount();

  const modal = document.getElementById('ideaModal');
  if (modal) modal.classList.add('active');

  setTimeout(() => {
    const input = document.getElementById('ideaFormTitle');
    if (input) input.focus();
  }, 100);
}

function openEditIdeaModal(ideaId) {
  const idea = state.ideas.find(i => String(i.id) === String(ideaId));
  if (!idea) return;

  if (typeof TMAHelper !== 'undefined') {
    TMAHelper.triggerHaptic('impact', 'light');
    TMAHelper.showBackButton(closeIdeaModal);
    TMAHelper.hideMainButton();
  }

  document.getElementById('ideaModalTitle').innerText = 'Edit Ide Konten';
  document.getElementById('ideaFormId').value = idea.id;
  document.getElementById('ideaFormTitle').value = idea.title || '';
  document.getElementById('ideaFormDesc').value = idea.description || '';
  document.getElementById('ideaFormCategory').value = idea.category || 'General';
  document.getElementById('ideaFormPriority').value = idea.priority || 'MEDIUM';
  document.getElementById('ideaFormStatus').value = idea.status || 'DRAFT';

  const errEl = document.getElementById('ideaFormError');
  if (errEl) errEl.style.display = 'none';

  updateTitleCharCount();

  const modal = document.getElementById('ideaModal');
  if (modal) modal.classList.add('active');
}

function closeIdeaModal() {
  const modal = document.getElementById('ideaModal');
  if (modal) modal.classList.remove('active');

  if (typeof TMAHelper !== 'undefined') {
    TMAHelper.hideBackButton();
    const activeNav = document.querySelector('.nav-item.active');
    if (activeNav && activeNav.id === 'nav-ideas') {
      TMAHelper.showMainButton("+ Tambah Ide Baru", openCreateIdeaModal);
    }
  }
}

function handleIdeaModalBackdropClick(e) {
  if (e.target && e.target.id === 'ideaModal') {
    closeIdeaModal();
  }
}

function updateTitleCharCount() {
  const input = document.getElementById('ideaFormTitle');
  const countEl = document.getElementById('titleCharCount');
  if (input && countEl) {
    countEl.innerText = input.value.length;
  }
}

async function submitIdeaForm() {
  const id = document.getElementById('ideaFormId').value;
  const title = (document.getElementById('ideaFormTitle').value || '').trim();
  const description = (document.getElementById('ideaFormDesc').value || '').trim();
  const category = (document.getElementById('ideaFormCategory').value || 'General').trim();
  const priority = document.getElementById('ideaFormPriority').value;
  const status = document.getElementById('ideaFormStatus').value;
  const errorEl = document.getElementById('ideaFormError');

  if (!title) {
    if (errorEl) {
      errorEl.innerText = 'Judul ide wajib diisi.';
      errorEl.style.display = 'block';
    }
    if (typeof TMAHelper !== 'undefined') {
      TMAHelper.triggerHaptic('notification', 'error');
    }
    return;
  }

  if (errorEl) errorEl.style.display = 'none';
  closeIdeaModal();

  const now = new Date().toISOString();

  if (!id) {
    // 1. CREATE ACTION (Optimistic UI)
    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
    const newIdea = {
      id: tempId,
      title: title,
      description: description,
      category: category,
      priority: priority,
      status: status,
      is_deleted: false,
      created_at: now,
      updated_at: now
    };

    const previousSnapshot = [...state.ideas];
    state.ideas.unshift(newIdea);
    renderIdeas();

    if (typeof TMAHelper !== 'undefined') {
      TMAHelper.triggerHaptic('notification', 'success');
    }
    showToast("Ide baru berhasil ditambahkan!", "success");

    try {
      const res = await callApi('createIdea', {
        id: tempId,
        title: title,
        description: description,
        category: category,
        priority: priority,
        status: status
      });

      if (res && res.success && res.data && res.data.id) {
        newIdea.id = String(res.data.id);
        renderIdeas();
      }
    } catch (err) {
      console.error("Failed to create idea on server:", err);
      // Rollback
      state.ideas = previousSnapshot;
      renderIdeas();
      showToast("Gagal menyimpan ide: " + err.message, "error");
      if (typeof TMAHelper !== 'undefined') {
        TMAHelper.triggerHaptic('notification', 'error');
      }
    }

  } else {
    // 2. UPDATE ACTION (Optimistic UI)
    const previousSnapshot = state.ideas.map(i => ({ ...i }));
    state.ideas = state.ideas.map(i => {
      if (String(i.id) === String(id)) {
        return {
          ...i,
          title: title,
          description: description,
          category: category,
          priority: priority,
          status: status,
          updated_at: now
        };
      }
      return i;
    });

    renderIdeas();

    if (typeof TMAHelper !== 'undefined') {
      TMAHelper.triggerHaptic('notification', 'success');
    }
    showToast("Perubahan ide berhasil disimpan!", "success");

    try {
      await callApi('updateIdea', {
        id: id,
        title: title,
        description: description,
        category: category,
        priority: priority,
        status: status
      });
    } catch (err) {
      console.error("Failed to update idea on server:", err);
      // Rollback
      state.ideas = previousSnapshot;
      renderIdeas();
      showToast("Gagal memperbarui ide: " + err.message, "error");
      if (typeof TMAHelper !== 'undefined') {
        TMAHelper.triggerHaptic('notification', 'error');
      }
    }
  }
}

// ------------------------------------------
// STATUS TOGGLE (OPTIMISTIC UI)
// ------------------------------------------

async function toggleIdeaStatus(ideaId) {
  if (typeof TMAHelper !== 'undefined') {
    TMAHelper.triggerHaptic('impact', 'medium');
  } else {
    triggerHaptic('medium');
  }

  const idea = state.ideas.find(i => String(i.id) === String(ideaId));
  if (!idea) return;

  const previousSnapshot = state.ideas.map(i => ({ ...i }));
  const nextStatus = (idea.status === 'DONE') ? 'DRAFT' : 'DONE';

  state.ideas = state.ideas.map(i => {
    if (String(i.id) === String(ideaId)) {
      return { ...i, status: nextStatus, updated_at: new Date().toISOString() };
    }
    return i;
  });

  renderIdeas();

  try {
    await callApi('updateIdea', { id: ideaId, status: nextStatus });
  } catch (err) {
    console.error("Failed to toggle idea status on server:", err);
    state.ideas = previousSnapshot;
    renderIdeas();
    showToast("Gagal memperbarui status: " + err.message, "error");
  }
}

// ------------------------------------------
// SOFT DELETE & 5-SECOND UNDO TOAST
// ------------------------------------------

async function promptDeleteIdea(ideaId) {
  let confirmed = false;
  if (typeof TMAHelper !== 'undefined') {
    confirmed = await TMAHelper.confirm("Apakah Anda yakin ingin menghapus ide ini?");
  } else {
    confirmed = window.confirm("Apakah Anda yakin ingin menghapus ide ini?");
  }

  if (!confirmed) return;

  if (typeof TMAHelper !== 'undefined') {
    TMAHelper.triggerHaptic('impact', 'medium');
  } else {
    triggerHaptic('medium');
  }

  // Jika masih ada item di antrean undo sebelumnya, finalisasi langsung
  if (state.undoQueue) {
    await finalizeDelete(state.undoQueue.id);
  }

  const idea = state.ideas.find(i => String(i.id) === String(ideaId));
  if (!idea) return;

  // Soft delete lokal (sembunyikan dari tampilan)
  idea.is_deleted = true;
  renderIdeas();

  // Tampilkan Undo Toast 5 detik
  const toast = document.getElementById('undoToast');
  const progressFill = document.getElementById('undoProgressFill');
  if (toast) {
    toast.style.display = 'flex';
    if (progressFill) {
      progressFill.style.transition = 'none';
      progressFill.style.width = '100%';
      // Force repaint
      void progressFill.offsetWidth;
      progressFill.style.transition = 'width 5000ms linear';
      progressFill.style.width = '0%';
    }
  }

  const timerId = setTimeout(() => {
    finalizeDelete(ideaId);
  }, 5000);

  state.undoQueue = {
    id: ideaId,
    timerId: timerId
  };
}

function executeUndoDelete() {
  if (!state.undoQueue) return;

  clearTimeout(state.undoQueue.timerId);
  const ideaId = state.undoQueue.id;
  state.undoQueue = null;

  const idea = state.ideas.find(i => String(i.id) === String(ideaId));
  if (idea) {
    idea.is_deleted = false;
    renderIdeas();
  }

  const toast = document.getElementById('undoToast');
  if (toast) toast.style.display = 'none';

  if (typeof TMAHelper !== 'undefined') {
    TMAHelper.triggerHaptic('notification', 'success');
  }
  showToast("Penghapusan ide dibatalkan.", "info");
}

async function finalizeDelete(ideaId) {
  if (state.undoQueue && state.undoQueue.id === ideaId) {
    clearTimeout(state.undoQueue.timerId);
    state.undoQueue = null;
  }

  const toast = document.getElementById('undoToast');
  if (toast) toast.style.display = 'none';

  try {
    const res = await callApi('deleteIdea', { id: ideaId });
    if (res && res.success) {
      // Hapus dari state lokal permanen
      state.ideas = state.ideas.filter(i => String(i.id) !== String(ideaId));
      renderIdeas();
    }
  } catch (err) {
    console.error("Gagal menghapus ide dari server:", err);
    const idea = state.ideas.find(i => String(i.id) === String(ideaId));
    if (idea) {
      idea.is_deleted = false;
      renderIdeas();
    }
    showToast("Gagal menghapus ide: " + err.message, "error");
  }
}

// ==========================================
// SEARCH & TOPIC INSPECTOR
// ==========================================
function handleSearchKeyPress(e) {
  if (e.key === 'Enter') {
    executeSearch();
  }
}

async function executeSearch() {
  const input = document.getElementById('searchInput');
  const query = input.value ? input.value.trim() : '';

  if (!query) return;

  triggerHaptic('light');
  const container = document.getElementById('searchResultsContainer');
  if (container) {
    container.innerHTML = `
      <div class="video-card skeleton" style="height: 82px;"></div>
      <div class="video-card skeleton" style="height: 82px;"></div>
    `;
  }

  try {
    const res = await callApi('searchVideos', { query: query });
    if (res && res.success) {
      renderSearchResults(res.videos);
    } else {
      renderSearchResults([]);
    }
  } catch (err) {
    renderSearchResults([]);
    showToast("Pencarian gagal: " + err.message, "error");
  }
}

function renderSearchResults(videos) {
  const container = document.getElementById('searchResultsContainer');
  if (!container) return;

  if (!videos || videos.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
        <p>Tidak ada video yang cocok dengan pencarian.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = videos.map(v => buildVideoCardHtml(v)).join('');
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function formatCompactNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  }
  return num.toString();
}

function formatNumberWithCommas(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function getRelativeTimeString(isoDateStr) {
  if (!isoDateStr) return '';
  const date = new Date(isoDateStr);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 3600) {
    const mins = Math.max(1, Math.floor(diffSec / 60));
    return `${mins}m ago`;
  }
  if (diffSec < 86400) {
    const hours = Math.floor(diffSec / 3600);
    return `${hours}h ago`;
  }
  const days = Math.floor(diffSec / 86400);
  if (days < 30) {
    return `${days}d ago`;
  }
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function getTimeElapsed(dateInput) {
  if (!dateInput) return '';
  const past = new Date(dateInput).getTime();
  if (isNaN(past)) return '';
  const now = Date.now();
  const elapsedSeconds = Math.max(0, Math.floor((now - past) / 1000));

  if (elapsedSeconds < 30) return 'Baru saja';

  const units = [
    { name: 'thn', seconds: 31536000 },
    { name: 'bln', seconds: 2592000 },
    { name: 'mgg', seconds: 604800 },
    { name: 'hr', seconds: 86400 },
    { name: 'jam', seconds: 3600 },
    { name: 'mnt', seconds: 60 }
  ];

  for (const unit of units) {
    const interval = Math.floor(elapsedSeconds / unit.seconds);
    if (interval >= 1) {
      return `${interval} ${unit.name} lalu`;
    }
  }
  return 'Baru saja';
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
