// ===================================================
// 1. COMMAND: /addidea [topik/ide video]
// ===================================================
function handleAddIdeaCommand(ideaText) {
  if (!ideaText) {
    return (
      `⚠️ *FORMAT SALAH*\n\n` +
      `Gunakan format: \`/addidea [topik/ide video]\`\n` +
      `Contoh: \`/addidea Cara membuat thumbnail estetik di Canva\``
    );
  }

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.IDEAS_SHEET_NAME);
    const lastRow = sheet.getLastRow();
    const newId = lastRow; // Auto increment ID sederhana berdasarkan baris

    const createdAt = Utilities.formatDate(new Date(), "Asia/Jakarta", "dd/MM/yyyy HH:mm");

    // Simpan ide baru: ID, Text Ide, Status (PLANNED), Tanggal Dibuat
    sheet.appendRow([newId, ideaText, "PLANNED", createdAt]);

    notifIdea(newId, ideaText, "PLANNED", createdAt);

    return (
      `*[ CONTENT PLANNER - IDE TERSIMPAN ]*\n` +
      `🗓 ${getTimeString()}\n` +
      `----------------------------------------\n\n` +
      `💡 *Ide Konten Baru (ID: #${newId}):*\n` +
      `"${escapeMarkdown(ideaText)}"\n\n` +
      `----------------------------------------\n` +
      `🟢 *Status:* Tersimpan di Backlog (PLANNED)`
    );

  } catch (error) {
    return msgError(parseErrorMsg(error), `Gagal menambahkan ide baru!`);
  }
}

function notifIdea(id, ideaText, state) {
  try {
    let header = `💡 *[ BARU DITAMBAHKAN ]*\n`;
    if(state == 'DONE') header = `🎉 *[ BARU DISELESAIKAN ]*\n`;
    sendTelegram((
      header +
      `🗓 ${getTimeString()}\n` +
      `----------------------------------------\n\n` +
      `💡 *Ide Konten (ID: #${id}):*\n` +
      `"${escapeMarkdown(ideaText)}"\n\n` +
      `----------------------------------------\n` +
      `🟢 *Status:* Tersimpan di Backlog (${state})`
    ), CONFIG.TELEGRAM_GROUP_CHAT_ID, CONFIG.TELEGRAM_GROUP_CHAT_TOPICS.IDEAS);
  } catch(e) {
    Logger.log(`Error kirim notif Idea: ${id} - ${ideaText} (${state})`);
  }
}

// ===================================================
// 2. COMMAND: /ideas (Menampilkan Daftar Ide Aktif)
// ===================================================
function handleListIdeasCommand() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.IDEAS_SHEET_NAME);
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
      return (
        `*[ CONTENT PLANNER - BACKLOG IDE ]*\n` +
        `🗓 ${getTimeString()}\n` +
        `----------------------------------------\n\n` +
        `📝 *Daftar Ide Konten:* Belum ada ide tersimpan.\n\n` +
        `💡 *Tips:* Ketik \`/addidea [judul ide]\` untuk mencatat ide baru.\n\n` +
        `----------------------------------------\n` +
        `🟡 *Status:* Backlog Kosong`
      );
    }

    // Ambil seluruh data ide
    const range = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    
    // Filter hanya ide yang berstatus PLANNED atau IN_PROGRESS (Abaikan DONE)
    const activeIdeas = range.filter(row => row[2] !== "DONE");

    if (activeIdeas.length === 0) {
      return (
        `*[ CONTENT PLANNER - BACKLOG IDE ]*\n` +
        `🗓 ${getTimeString()}\n` +
        `----------------------------------------\n\n` +
        `🎉 *Semua ide telah diproduksi/selesai!*\n\n` +
        `💡 *Tips:* Ketik \`/addidea [judul ide]\` untuk menambah ide baru.\n\n` +
        `----------------------------------------\n` +
        `🟢 *Status:* Semua Task Selesai`
      );
    }

    return msgIdeasDashboard(activeIdeas);

  } catch (error) {
    return msgError(parseErrorMsg(error));
  }
}

function msgIdeasDashboard(ideas) {
  let listContent = "";

  ideas.forEach((row) => {
    const id = row[0];
    const text = escapeMarkdown(row[1]);
    const status = row[2] === "IN_PROGRESS" ? "⏳ *[PROSES]*" : "📌 *[PLANNED]*";

    listContent += `${status} \`#${id}\` - ${text}\n`;
  });

  return (
    `*[ CONTENT PLANNER - BACKLOG IDE ]*\n` +
    `🗓 ${getTimeString()}\n` +
    `----------------------------------------\n\n` +
    `📝 *DAFTAR IDE AKTIF (${ideas.length}):*\n\n` +
    `${listContent}\n` +
    `----------------------------------------\n` +
    `💡 Ketik \`/done [ID]\` jika video selesai diproduksi.\n` +
    `🟢 *Status:* Data Ide Diperbarui`
  );
}

// ===================================================
// 3. COMMAND: /done [ID] (Tandai Ide Sudah Dibuat)
// ===================================================
function handleDoneIdeaCommand(ideaId) {
  if (!ideaId || isNaN(ideaId)) {
    return (
      `⚠️ *FORMAT SALAH*\n\n` +
      `Gunakan format: \`/done [ID_IDE]\`\n` +
      `Contoh: \`/done 2\``
    );
  }

  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.IDEAS_SHEET_NAME);
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) return;

    const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    let foundRow = -1;
    let ideaText = "";

    for (let i = 0; i < data.length; i++) {
      if (data[i][0] == ideaId) {
        foundRow = i + 2; // Baris riil di sheet (offset header)
        ideaText = data[i][1];
        break;
      }
    }

    if (foundRow === -1) {
      return `❌ *Ide dengan ID #${ideaId} tidak ditemukan.*`;
    }

    // Ubah status kolom C menjadi DONE
    sheet.getRange(foundRow, 3).setValue("DONE");

    const idea = sheet.getRange(foundRow, 1, 1, 4).getValues()[0];
    if(idea) {
      notifIdea(idea[0], idea[1], idea[2]);
    }

    return (
      `*[ CONTENT PLANNER - TASK COMPLETED ]*\n` +
      `🗓 ${getTimeString()}\n` +
      `----------------------------------------\n\n` +
      `✅ *Ide Berhasil Dikeluarkan dari Backlog:*\n` +
      `\`#${ideaId}\` - "${escapeMarkdown(ideaText)}"\n\n` +
      `----------------------------------------\n` +
      `🎉 *Status:* Selesai (DONE)`
    );

  } catch (error) {
    return msgError(parseErrorMsg(error));
  }
}