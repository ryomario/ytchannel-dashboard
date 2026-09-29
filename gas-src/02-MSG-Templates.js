// ===================================================
// TEMPLATE PESAN TELEGRAM - SHARED TEMPLATES
// ===================================================

function buildTelegramMessage(options) {
  const title = options && options.title ? options.title : 'SYSTEM UPDATE';
  const timestamp = options && options.timestamp ? options.timestamp : getTimeString();
  const summary = options && options.summary ? options.summary : '';
  const lines = Array.isArray(options && options.lines) ? options.lines : [];
  const footer = options && options.footer ? options.footer : '';
  const type = options && options.type ? options.type : 'info';

  const prefixMap = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '🔴',
    critical: '🛑'
  };

  const prefix = prefixMap[type] || 'ℹ️';
  const content = [];

  content.push(prefix + ' *[' + String(title).toUpperCase() + ']*');
  content.push('🗓 ' + timestamp);
  content.push(repeatStr('-', 60));

  if (summary) {
    content.push(summary);
  }

  if (lines.length > 0) {
    content.push('');
    lines.forEach(function(line) {
      content.push(line);
    });
  }

  content.push(repeatStr('-', 60));

  if (footer) {
    content.push(footer);
  }

  return content.join('\n');
}

// ===================================================
// PESAN: ERROR
// ===================================================
function msgError(errorMessage, cause = 'Gagal mengambil data statistik YouTube') {
  return buildTelegramMessage({
    type: 'error',
    title: 'Error Report',
    summary: '⚠️ *Kegagalan:* ' + String(cause),
    lines: [
      '🔍 *Pesan Error:*',
      '```' + escapeMarkdown(String(errorMessage).slice(0, 500)) + '```'
    ],
    footer: '📌 *Tindakan:* Penanganan otomatis disiapkan.'
  });
}