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
  growthData: null,
  activeIdeaFilter: 'pending' // 'pending' | 'completed'
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
  if (tg) {
    try {
      tg.ready();
      tg.expand();
      if (tg.setHeaderColor) {
        tg.setHeaderColor('bg_color');
      }
    } catch (e) {
      console.warn("Telegram WebApp initialization warning:", e);
    }
  }
}

function triggerHaptic(style = 'light') {
  if (tg && tg.HapticFeedback) {
    try {
      if (style === 'selection') {
        tg.HapticFeedback.selectionChanged();
      } else {
        tg.HapticFeedback.impactOccurred(style); // 'light' | 'medium' | 'heavy'
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
        handlePasswordSubmit(() => refreshDashboardData());
      }
    });
  }

  // Tombol submit modal password
  const modalSubmitBtn = document.getElementById('modalSubmitBtn');
  if (modalSubmitBtn) {
    modalSubmitBtn.addEventListener('click', () => {
      handlePasswordSubmit(() => refreshDashboardData());
    });
  }

  // Tombol retry di layar unauthorized
  const unauthorizedRetryBtn = document.getElementById('unauthorizedRetryBtn');
  if (unauthorizedRetryBtn) {
    unauthorizedRetryBtn.addEventListener('click', () => {
      showPasswordModal();
    });
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
}

// ==========================================
// DATA FETCHING & API INTEGRATION
// ==========================================
async function refreshDashboardData() {
  triggerHaptic('light');
  showLoadingSkeletons();

  const btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) btnRefresh.classList.add('spinning');

  try {
    const res = await callApi('getDashboardData');
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
  state.ideas = res.ideas || [];
  state.growthData = res.growthData || null;

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
  const chartWrapper = document.querySelector('.chart-canvas-wrapper');
  if (chartWrapper) chartWrapper.classList.remove('chart-loading');

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
  if (growthChartInstance) {
    growthChartInstance.destroy();
    growthChartInstance = null;
  }

  const chartCanvas = document.getElementById('growthChart');
  if (chartCanvas) {
    const ctx = chartCanvas.getContext('2d');
    ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
  }

  const chartWrapper = document.querySelector('.chart-canvas-wrapper');
  if (chartWrapper) {
    chartWrapper.classList.add('chart-loading');
  }

  const dashListEl = document.getElementById('dashVideoList');
  if (dashListEl) {
    dashListEl.innerHTML = `
      <div class="video-card skeleton" style="height: 82px;"></div>
      <div class="video-card skeleton" style="height: 82px;"></div>
      <div class="video-card skeleton" style="height: 82px;"></div>
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

  const chartWrapper = document.querySelector('.chart-canvas-wrapper');
  if (chartWrapper) {
    chartWrapper.classList.remove('chart-loading');
  }

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
          pointRadius: totalPoints > 30 ? 2 : 3.5,
          pointHoverRadius: 6
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
          pointRadius: totalPoints > 30 ? 2 : 3.5,
          pointHoverRadius: 6
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
// CONTENT PLANNER / IDEAS BOARD
// ==========================================
function setIdeaFilter(filterType) {
  triggerHaptic('selection');
  state.activeIdeaFilter = filterType;

  document.getElementById('filterPending').classList.toggle('active', filterType === 'pending');
  document.getElementById('filterCompleted').classList.toggle('active', filterType === 'completed');

  renderIdeas();
}

function renderIdeas() {
  const container = document.getElementById('ideaContainer');
  if (!container) return;

  const pendingIdeas = state.ideas.filter(i => i.status === 'pending');
  const completedIdeas = state.ideas.filter(i => i.status === 'completed');

  document.getElementById('countPending').innerText = pendingIdeas.length;
  document.getElementById('countCompleted').innerText = completedIdeas.length;

  const displayList = state.activeIdeaFilter === 'pending' ? pendingIdeas : completedIdeas;

  if (displayList.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24"><path d="M9 21c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-1H9v1zm3-19C8.14 2 5 5.14 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.86-3.14-7-7-7z"/></svg>
        <p>${state.activeIdeaFilter === 'pending' ? 'Belum ada ide konten yang direncanakan.' : 'Belum ada ide yang diselesaikan.'}</p>
      </div>
    `;
    return;
  }

  container.innerHTML = displayList.map(idea => `
    <div class="idea-card ${idea.status === 'completed' ? 'completed' : ''}">
      <div class="idea-text">${escapeHtml(idea.text)}</div>
      <button class="idea-checkbox-btn" title="Toggle Status" onclick="toggleIdeaDone('${idea.id}')">
        <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
      </button>
    </div>
  `).join('');
}

function handleIdeaKeyPress(e) {
  if (e.key === 'Enter') {
    submitNewIdea();
  }
}

async function submitNewIdea() {
  const input = document.getElementById('ideaInput');
  const text = input.value ? input.value.trim() : '';

  if (!text) return;

  triggerHaptic('medium');
  input.value = '';

  // Optimistic UI update
  const tempIdea = {
    id: 'idea_' + Date.now(),
    text: text,
    status: 'pending',
    createdAt: new Date().toISOString()
  };
  state.ideas.unshift(tempIdea);
  renderIdeas();

  try {
    const res = await callApi('addNewIdea', { text: text });
    if (res && res.success) {
      state.ideas = res.ideas;
      renderIdeas();
      showToast("Ide baru berhasil disimpan!", "success");
    }
  } catch (err) {
    showToast("Gagal menyimpan ide: " + err.message, "error");
  }
}

async function toggleIdeaDone(ideaId) {
  triggerHaptic('medium');

  // Optimistic UI update
  state.ideas = state.ideas.map(idea => {
    if (idea.id === ideaId || String(idea.id) === String(ideaId)) {
      idea.status = idea.status === 'completed' ? 'pending' : 'completed';
    }
    return idea;
  });
  renderIdeas();

  try {
    const res = await callApi('markIdeaDone', { ideaId: ideaId });
    if (res && res.success) {
      state.ideas = res.ideas;
      renderIdeas();
    }
  } catch (err) {
    showToast("Gagal memperbarui status ide: " + err.message, "error");
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
