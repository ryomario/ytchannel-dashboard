// ===================================================
// TEMPLATE PESAN TELEGRAM - SHARED TEMPLATES
// ===================================================

// ===================================================
// PESAN: ERROR
// ===================================================
function msgError(errorMessage, cause = 'Gagal mengambil data statistik YouTube') {
  return (
    `🔴 *[ ERROR REPORT ]*\n` +
    `🗓 ${getTimeString()}\n` +
    `${repeatStr('-',60)}\n\n` +
    `⚠️ *Kegagalan:* ${cause}\n\n` +
    `🔍 *Pesan Error:*\n` +
    `\`${errorMessage}\`\n\n` +
    `${repeatStr('-',60)}\n` +
    `📌 *Tindakan:* Penanganan otomatis disiapkan.`
  );
}