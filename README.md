# MDG Material Form (Cloud) — Ready Package

## Cara Pakai Singkat
1) **Opsional (disarankan)**: Deploy *Apps Script Exporter* (file `apps_script_exporter.gs`) sebagai **Web App** → salin URL `/exec` lalu masukkan ke **DATA_URL** (bisa isi langsung di UI atau set `PREFILL_DATA_URL` di `index.html`).  
2) **Opsional**: Deploy *Apps Script Receiver* (file `apps_script_receiver.gs`) sebagai **Web App** → isi **SUBMIT_URL** untuk menyimpan setiap submit ke Google Sheet.  
3) Hosting statis (pilih salah satu):  
   - **GitHub Pages**: upload seluruh folder, aktifkan Pages (branch `main`, folder `/`).  
   - **Cloudflare Pages**: *Create a project → Upload assets* (upload seluruh folder).  
   - **Google Sites**: gunakan `Embed` URL bila perlu, atau host via Drive lalu embed.

> Jika **DATA_URL** kosong, halaman akan memakai **./data/form_data.json** (fallback). Ganti berkas ini jika ingin memperbarui data secara statis.

## Menyetel Apps Script (Exporter)
- Buka **Extensions → Apps Script**, buat project baru.
- Tempel isi `apps_script_exporter.gs`.
- Ganti:
  - `CLASS_SHEET_ID` → ID spreadsheet “Class - Material”
  - `CHAR_SHEET_ID` → ID spreadsheet “Characteristic - Material”
  - (opsional) ubah nama tab jika berbeda
- **Deploy → New deployment → Web app** (Execute as: *Me*, Who has access: *Anyone*).  
- Salin URL `/exec` → tempel di kolom **DATA_URL** saat runtime atau set `PREFILL_DATA_URL` di `index.html`.

## Menyetel Apps Script (Receiver)
- Buka Apps Script baru, tempel `apps_script_receiver.gs`.
- Ganti `RESP_SHEET_ID` dengan ID Google Sheet tujuan.
- Deploy sebagai Web App (Execute as: *Me*, Who has access: *Anyone*).
- Salin URL `/exec` → tempel ke **SUBMIT_URL** (opsional).

## Men-deploy ke GitHub Pages
- Buat repo publik → upload semua isi paket ini (pastikan `index.html` di root).
- Settings → Pages → Deploy from a branch → `main` / `/ (root)`.

## Catatan
- **Table 1**: bila tetap “fixed offline”, aturan perakitan (Case/Prefix/Suffix/Without Space) sebaiknya sudah tergabung di data JSON (./data/form_data.json). Jika Anda ingin membuatnya dinamis juga, pindahkan Table 1 ke Google Sheets dan perluas `apps_script_exporter.gs` untuk menyatukannya ke output JSON.
- Ukuran JSON besar? Anda bisa tetap pakai Apps Script agar tidak perlu mengganti berkas di hosting setiap update.
