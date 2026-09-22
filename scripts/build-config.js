const fs = require('fs');
const path = require('path');

/**
 * Script untuk menghasilkan frontend/js/config.js
 * dari environment variable (GitHub Secrets/Vars) atau berkas .env lokal.
 */

// 1. Baca .env jika ada (tanpa butuh external dependency dotenv)
function parseEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('#')) continue;

    const eqIdx = line.indexOf('=');
    if (eqIdx !== -1) {
      const key = line.slice(0, eqIdx).trim();
      let value = line.slice(eqIdx + 1).trim();

      // Hapus kutip di awal dan akhir jika ada
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      env[key] = value;
    }
  }
  return env;
}

// Cari .env di root atau di frontend/
const rootEnvPath = path.resolve(__dirname, '../.env');
const frontendEnvPath = path.resolve(__dirname, '../frontend/.env');
const fileEnv = {
  ...parseEnvFile(rootEnvPath),
  ...parseEnvFile(frontendEnvPath)
};

// Ambil nilai GAS_WEBAPP_URL dari:
// 1. process.env (di-inject oleh CI/CD GitHub Actions)
// 2. .env file lokal
// 3. Fallback default
const gasWebappUrl = process.env.GAS_WEBAPP_URL ||
  fileEnv.GAS_WEBAPP_URL ||
  'https://script.google.com/macros/s/AKfycbx_SAMPLE_DEPLOYMENT_ID/exec';

const targetConfigFile = path.resolve(__dirname, '../frontend/js/config.js');

const configContent = `/**
 * ===================================================
 * FRONTEND PUBLIC CONFIGURATION (AUTO-GENERATED)
 * Dihasilkan otomatis saat build / deployment dari .env atau GitHub Environment.
 * Jangan edit berkas ini secara langsung jika menggunakan CI/CD.
 * ===================================================
 */
const APP_CONFIG = {
  GAS_WEBAPP_URL: ${JSON.stringify(gasWebappUrl)},
  REQUEST_TIMEOUT_MS: 30000
};
`;

fs.writeFileSync(targetConfigFile, configContent, 'utf-8');
console.log('✅ frontend/js/config.js berhasil dibuat!');
console.log(`📌 GAS_WEBAPP_URL: ${gasWebappUrl}`);
