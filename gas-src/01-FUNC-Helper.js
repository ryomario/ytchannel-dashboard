// Parse error message
function parseErrorMsg(e) {
  if(typeof e?.toString() === 'string') return e.toString();
  if(typeof e?.message === 'string') return e.message;
  if(typeof e === 'string') return e;
  if(typeof e === 'object') return JSON.stringify(e);
  return 'Error tidak diketahui';
}

/**
 * Mengubah tanggal atau timestamp menjadi format waktu relatif (Time Elapsed)
 * @param {Date|number|string} dateInput - Tanggal, timestamp, atau string tanggal ISO
 * @return {string} Teks waktu berlalu dalam bahasa Indonesia
 */
function getTimeElapsed(dateInput) {
  const past = new Date(dateInput).getTime();
  const now = new Date().getTime();
  const elapsedSeconds = Math.floor((now - past) / 1000);

  // Jika tanggal di masa depan atau baru saja terjadi
  if (elapsedSeconds < 5) return 'Baru saja';

  const units = [
    { name: 'tahun', seconds: 31536000 },
    { name: 'bulan', seconds: 2592000 },
    { name: 'minggu', seconds: 604800 },
    { name: 'hari', seconds: 86400 },
    { name: 'jam', seconds: 3600 },
    { name: 'menit', seconds: 60 },
    { name: 'detik', seconds: 1 }
  ];

  for (const unit of units) {
    const interval = Math.floor(elapsedSeconds / unit.seconds);
    if (interval >= 1) {
      return `${interval} ${unit.name} yang lalu`;
    }
  }
}

function repeatStr(str = '', repeat = 10) {
  let str_result = '';
  while(repeat > 0) {
    str_result += `${str}`;
    repeat-=1;
  }
  return str_result;
}

// Fungsi helper: format angka dengan titik (1000 -> 1.000)
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function formatUSD(amount) {
  return "$" + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Fungsi helper: ambil waktu sekarang (WIB)
function getTimeString(d = null, showTime = true) {
  const now = d ? new Date(d) : new Date();
  const wib = new Date(now.getTime() + (7 * 60 * 60 * 1000));
  const days = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];
  const day = days[wib.getUTCDay()];
  const date = wib.toISOString().slice(0, 10).split("-").reverse().join("/");
  const time = wib.toISOString().slice(11, 16);
  let str = `${day}, ${date}`;
  if(showTime) {
    str += ` • ${time} WIB`;
  }
  return str;
}

// Mencegah karakter markdown merusak parser jika judul video ada karakter khusus
function escapeMarkdown(text) {
  return text.replace(/[*_`\[\]]/g, "");
}

// ===================================================
// HELPER: EKSTRAKSI VIDEO ID DARI LINK/TEXT
// ===================================================
function extractVideoId(input) {
  // Regex untuk menangkap ID dari berbagai format URL YouTube
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = input.match(regExp);

  if (match && match[2].length === 11) {
    return match[2];
  } else if (input.length === 11) {
    return input; // Jika pengguna langsung memasukkan ID 11 karakter
  }
  return null;
}
