# Product Requirement Document (PRD)
## YouTube Channel Observer & Manager — Telegram Mini App (GAS Edition)

### 1. Document Overview
* **Product Name:** YouTube Observer Mini App for Telegram
* **Target Environment:** Google Apps Script (GAS) Web App + Telegram Web App SDK
* **Developer Context:** Solo Web Developer / Content Creator
* **AI Tooling:** Antigravity AI Agent (Local Dev) -> Manual Upload to Google Apps Script
* **Tech Stack:** HTML5, Modern CSS (Glassmorphism / Telegram Dark Theme), Vanilla JavaScript (ES6+), Google Apps Script (`Code.gs` + `YouTube Data API v3` Advanced Service).

---

### 2. Objectives & Problem Statement
#### 2.1 Core Problem
Mengamati analitik channel YouTube, mengelola ide konten, dan mengecek performa video melalui browser/YouTube Studio desktop memakan waktu dan mengganggu alur kerja koding harian.
#### 2.2 Objective
Membangun antarmuka Mini App terintegrasi di dalam Telegram yang:
1. Menampilkan metrik performa channel & video secara instan dan visual.
2. Memudahkan pencatatan, penelusuran, dan checklist ide konten YouTube Shorts.
3. Tetap mempertahankan fungsi *Telegram Bot Webhook* (`doPost`) yang sudah berjalan, sekaligus melayani Mini App (`doGet`).

---

### 3. System Architecture & File Structure

Aplikasi di-deploy langsung dari project Google Apps Script yang sama:

```text
[Local / Antigravity Agent Workspace]
├── Code.gs             # Backend GAS (Webhook doPost, WebApp doGet, API Handlers)
├── Index.html          # Main HTML structure & Telegram SDK initialization
├── Styles.html         # Modern Glassmorphism CSS & Dark Theme Variables
└── Scripts.html        # Client-side JS (Tab Switching, Data Fetching, Haptics)

```

#### Routing & Data Flow

1. **`doPost(e)`**: Menangani pesan bot teks reguler (`/stats`, `/latest`, `/ideas`, `/addidea`, `/done`, `/search`, `/top`, `/check`, `/trend`).
2. **`doGet(e)`**: Me-render `Index.html` dengan konfigurasi `HtmlService.XFrameOptionsMode.ALLOWALL` agar dapat dibuka sebagai iframe Telegram Mini App.
3. **Data Exchange**: Frontend memanggil fungsi GAS backend menggunakan `google.script.run` (asynchronous, zero-CORS configuration).

---

### 4. Key Feature Specifications

#### 4.1 Feature 1: Channel Overview & KPI Cards

* **Description:** Menampilkan ringkasan metrik utama channel di bagian atas layar.
* **Metrics:**
* Total Subscribers (dengan formatting ribuan: `1.2K`).
* Total Lifetime Views.
* Total Videos Published.


* **UI Elements:** 3-column micro-card layout dengan border semi-transparan dan ikon minimalis.

#### 4.2 Feature 1.1: Subscribers & Views Growth Trend Chart
* **Description:** Grafik tren pertumbuhan channel memanjang yang menampilkan kurva Subscribers dan Views harian.
* **Data Source:** Terhubung langsung ke spreadsheet history harian dari cron `AnalyticsDB.gs` (`recordDailyStats`), dengan fallback otomatis saat offline/preview.
* **Visual Representation:**
  * **Sumbu X:** Hari pencatatan (7 hari terakhir: `Min`, `Sen`, `Sel`, `Rab`, `Kam`, `Jum`, `Sab`).
  * **Dual Y-Axis:** Sumbu kiri untuk Subscribers (aksen merah `#ff4444`) dan sumbu kanan untuk Views (aksen biru `#2aabee`) agar fluktuasi kedua metrik tampak proporsional tanpa flattening.
  * **Interactivity:** Tooltip saat touch/hover, indikator selisih pertumbuhan total periode (`+X Subs`, `+Y Views`).

#### 4.3 Feature 2: Latest Videos Performance Tracker

* **Description:** Daftar 5 video / Shorts terbaru dengan indikator performa.
* **Data Fields:** Thumbnail video, Judul video, Tanggal publish, View count, Like count, Comment count.
* **Interaction:** Klik kartu video membuka video langsung di aplikasi YouTube atau men-trigger feedback haptic Telegram.

#### 4.3 Feature 3: Content Planner & Idea Board (Kanban / Checklist)

* **Description:** Sistem manajemen ide konten terintegrasi yang terhubung dengan command bot `/addidea` dan `/done`.
* **Sub-Features:**
* **Quick Add Idea:** Input bar di dalam Mini App untuk menambahkan ide baru tanpa mengetik bot command.
* **Status Filter:** Tab "Pending / In Progress" vs "Completed / Published".
* **Action Button:** Tombol checklist untuk menandai ide selesai (`/done`).



#### 4.4 Feature 4: Search & Topic Inspector

* **Description:** Kolom pencarian instan untuk mencari riwayat video di channel berdasarkan keyword/topik tertentu (memanfaatkan fungsi `msgSearchResults` yang sudah ada).

#### 4.5 Feature 5: Native Telegram WebApp Integration

* **Theme Sync:** Menggunakan CSS custom properties bawaan Telegram (`--tg-theme-bg-color`, `--tg-theme-secondary-bg-color`, `--tg-theme-text-color`).
* **Haptic Feedback:** `Telegram.WebApp.HapticFeedback.impactOccurred('light' | 'medium')` saat tab berpindah atau data di-refresh.
* **MainButton / BackButton:** Mengontrol navigasi modal Telegram native.

---

### 5. Technical Requirements for Antigravity AI

Saat mengembangkan file script secara lokal menggunakan agent Antigravity AI, pastikan instruksi berikut diikuti:

#### 5.1 `Code.gs` Requirements

1. **Preserve Existing Logic:** Jangan menghapus logic `doPost(e)` yang menangani command `/stats`, `/latest`, `/search`, `/top`, `/check`, `/trend`, `/addidea`, `/ideas`, dan `/done`.
2. **Implement `doGet(e)`:**
```javascript
function doGet(e) {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('YouTube Channel Manager')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

```


3. **Expose Client-Callable Backend Endpoints:**
* `getChannelDashboardData()` -> Mengembalikan JSON berisi stats channel, 5 video terbaru, dan daftar ide aktif.
* `addNewIdeaFromWebApp(text)` -> Menyimpan ide baru dan mengembalikan daftar ide terupdate.
* `markIdeaDoneFromWebApp(id)` -> Mengubah status ide menjadi selesai.



#### 5.2 `Index.html`, `Styles.html`, `Scripts.html` Requirements

1. **Single-Bundle via Include:** Pisahkan CSS ke `Styles.html` dan JS ke `Scripts.html`, lalu gunakan `<?!= include('Styles'); ?>` dan `<?!= include('Scripts'); ?>` di `Index.html`.
2. **Zero External CSS Frameworks:** Gunakan CSS murni (Glassmorphism, Flexbox/Grid modern) untuk menjaga bundle tetap ringan (<50KB) dan instan saat dibuka di Telegram webview.
3. **Telegram SDK Script:** Wajib memuat `<script src="https://telegram.org/js/telegram-web-app.js"></script>` di `<head>`.

---

### 6. UI/UX Design Guidelines (Dark Mode Glassmorphism)

* **Background:** Dark slate / Telegram dynamic theme variable.
* **Cards:** `background: rgba(255, 255, 255, 0.05); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px;`
* **Typography:** System fonts (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`).
* **Active Accent:** Crimson red (`#FF0000` / `#FF4444`) untuk aksen khas YouTube, berpadu dengan aksen Telegram Blue (`#2AABEE`).

---

### 7. Step-by-Step Deployment Guide (Manual Upload)

1. Jalankan prompt pembuatan kode ke **Antigravity AI Agent** dengan melampirkan dokumen PRD ini.
2. Buka project **Google Apps Script** di browser.
3. Buka menu **Services (+)** di sidebar kiri -> Tambahkan **YouTube Data API v3**.
4. Salin kode `Code.gs`, lalu buat file HTML baru: `Index.html`, `Styles.html`, dan `Scripts.html`.
5. Klik **Deploy** -> **New Deployment** -> Pilih tipe **Web App**:
* *Execute as:* **Me**
* *Who has access:* **Anyone**


6. Salin URL Web App yang dihasilkan.
7. Di Telegram `@BotFather`, jalankan `/mybots` -> Pilih bot kamu -> **Bot Settings** -> **Menu Button** -> Masukkan URL Web App tersebut agar muncul tombol permanen di keyboard Telegram.
