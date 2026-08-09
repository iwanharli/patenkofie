# Patenote

Patenote adalah aplikasi operasional untuk layanan kopi masuk, penggilingan, roasting, pembayaran tunai, QR label, dan serah terima order dengan bukti foto.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Radix UI, Lucide icons, Recharts.
- Backend: Go, Chi router, pgx PostgreSQL, zerolog, bcrypt.
- Database: PostgreSQL lokal, default database `db_patenandum`.
- Upload: foto serah terima disimpan di `backend/uploads`.

## Menjalankan Aplikasi

Jalankan backend dan frontend dalam satu terminal:

```sh
./run.sh
```

Default:

- Frontend: `http://127.0.0.1:5173`
- Backend: `http://127.0.0.1:8080`

Jika port sedang dipakai, `run.sh` otomatis memilih port berikutnya.

## Akun Awal

```txt
username: ilham
password: ilhamganteng
role: OWNER
```

## Setup Database

Pastikan PostgreSQL lokal sudah berjalan, lalu jalankan migration:

```sh
./scripts/migrate-local.sh
```

Script ini akan:

- Membuat database `db_patenandum` jika belum ada.
- Menjalankan migration `.up.sql` yang belum tercatat.
- Mencatat migration di tabel `schema_migrations`.

## Konfigurasi Backend

Contoh env tersedia di `backend/.env.example`.

```sh
cd backend
cp .env.example .env
go run ./cmd/server
```

Env penting:

- `APP_PORT`: port backend.
- `DATABASE_URL`: koneksi PostgreSQL.
- `UPLOAD_DIR`: folder penyimpanan upload.
- `MAX_UPLOAD_MB`: batas file upload mentah sebelum kompresi.

## Perintah Verifikasi

Backend:

```sh
cd backend
go test ./...
```

Frontend:

```sh
cd frontend
npm run lint
npm run build
```

## Fitur Yang Sudah Ada

- **Auth & Akses Role**:
  - Login dan proteksi halaman berbasis session cookie.
  - Peran `OWNER` dan `STAFF` dengan pembatasan hak akses manajemen pengguna.
- **Layout & Navigasi Admin**:
  - Halaman Login sinematik 4K profesional.
  - Sidebar collapse, topbar dengan minimalist icon scan QR, profile dropdown, modal, dan toast global.
  - **Mobile-Responsive 100%**: Layout tabel daftar order, laporan, dan detail pelanggan otomatis berubah menjadi *Card Layout* yang elegan saat dibuka di layar HP.
- **Dashboard Real**:
  - Metrik transaksi, berat kopi, kas tunai (format rupiah penuh tanpa pembulatan), dan sisa pembayaran.
  - Rentang tanggal `Dari` dan `Sampai`.
  - Antrean order aktif yang lega (Full-width).
  - Transaksi terbaru menampilkan 15 baris terakhir dengan proporsi seimbang tanpa *scroll horizontal*.
  - Volume layanan & aktivitas hari ini.
- **Transaksi**:
  - Daftar transaksi dari database.
  - Filter, sort, pagination 10 per halaman.
  - Buat transaksi baru dengan berat kilogram/gram.
  - Saran pelanggan dari data tersimpan.
  - Detail transaksi.
  - Update status single dan bulk (bulk update khusus status awal yang sama).
  - Hapus transaksi khusus `OWNER`.
- **Manajemen Pelanggan Real**:
  - Daftar pelanggan real dari PostgreSQL (pagination 12 per halaman & pencarian dengan debounce).
  - Detail pelanggan: metrik total belanja, total volume (kg), total order, dan sisa piutang.
  - Riwayat transaksi per pelanggan dengan pagination.
  - Modal **Edit Data Pelanggan** (ubah nama, nomor telepon, alamat, catatan) langsung ter-update ke DB & UI.
- **Manajemen Pengguna Real (User Management)**:
  - Daftar akun pengguna (OWNER & STAFF) dari database.
  - Modal **Tambah Pengguna Baru** dengan proteksi hashing password `bcrypt`.
  - Detail profil akun.
  - Modal **Ubah Akun** (ubah nama lengkap, role `OWNER`/`STAFF`, atau status `Aktif`/`Nonaktif`).
  - Modal **Reset Password** untuk mengeset password akun baru.
  - Proteksi penuh: hanya role `OWNER` yang berhak mengelola akun pengguna.
- **Laporan Operasional Real & Ekspor CSV**:
  - Filter Card Horizontal Full-Width:
    - Periode: **Bulan Ini** (default), *Hari Ini*, *7 Hari Terakhir*, dan **Tanggal Kustom (`Dari Tanggal` & `Sampai Tanggal`)**.
    - Jenis Layanan: *Semua Layanan*, *Giling (G)*, *Roasting (R)*, *Giling+Roasting (GR)*.
    - Status Produksi & Status Pembayaran.
    - Tombol Reset Filter.
  - 4 Kartu Metrik Ringkasan: Nilai Transaksi, Penerimaan Cash, Volume Layanan, Piutang (Belum Lunas).
  - **Grafik Recharts Interaktif**: AreaChart gradien hijau emerald dengan deret tanggal harian yang utuh via query `generate_series` PostgreSQL, sumbu Y rupiah terformat (`549k`, `1.2jt`), dan Tooltip detail popover.
  - **Ekspor CSV**: Tombol "Ekspor CSV" yang secara dinamis di-generate langsung dari backend mengikuti filter aktif.
- **Pembayaran**:
  - Daftar pembayaran tunai dari database.
  - Detail bukti pembayaran.
  - Pelunasan order dari detail transaksi (otomatis membuat record `payments` dan status bayar `LUNAS`).
- **QR dan Label**:
  - Halaman cetak label order dengan QR code.
  - Minimalist icon scan QR di Topbar.
- **Serah Terima (Pickup)**:
  - Halaman pickup per transaksi.
  - Kamera langsung fullscreen & fallback upload file.
  - Foto dikompres sebelum disimpan sebagai JPEG (max 1600px).
- **Scan QR Kamera Browser Real**:
  - Penuh menggunakan library `html5-qrcode` untuk mengakses kamera laptop/HP secara langsung.
  - Pilihan kamera (depan/belakang/USB external).
  - Mode tujuan: Buka Detail Order (`/orders/{code}`) atau Serah Terima / Pickup (`/orders/{code}/pickup`).
  - Input pencarian manual kode order + pencarian langsung via Search Bar Topbar.
- **Profil Toko & Backup Database 1-Klik**:
  - `GET /api/v1/settings/profile` & `PATCH /api/v1/settings/profile` untuk mengelola identitas usaha (`business_name`, `business_address`, `business_phone`, `receipt_footer`).
  - Identitas toko & catatan kaki nota tercetak secara dinamis pada label QR & bukti pembayaran.
  - `GET /api/v1/settings/backup` untuk mengunduh berkas dump cadangan database (`.sql`) secara 1-klik (khusus OWNER).
- **Cetak Struk Kasir (Thermal)**:
  - Layout khusus untuk dicetak pada printer POS Bluetooth 58mm atau 80mm.
  - Memuat dinamis identitas toko dari database (Nama, Alamat, Footer).
- **Notifikasi Real-time**:
  - Halaman daftar notifikasi personal pengguna.
  - Tanda unread counter di Topbar (Lonceng Notifikasi).
  - Konfigurasi preferensi (enable/disable) notifikasi langsung tersimpan ke profil akun.
- **Audit Log Viewer Real**:
  - `GET /api/v1/audit-logs` untuk membaca riwayat aktivitas sistem dari database `audit_logs` (khusus OWNER).
  - Tab **"Audit log"** pada menu Pengaturan (`/settings/audit`).
  - Pencarian dengan debounce, filter jenis aksi (`CREATE_ORDER`, `UPDATE_ORDER`, `VOID_PAYMENT`, `RESET_PASSWORD`, dll), filter entitas, dan pagination 15 per halaman.
- **Koreksi & Pembatalan Pembayaran**:
  - `PATCH /api/v1/payments/{code}` untuk mengoreksi nominal tunai/catatan (khusus OWNER).
  - `DELETE /api/v1/payments/{code}` untuk membatalkan/menghapus record pembayaran (khusus OWNER).
  - Menghitung ulang `paid_amount` dan `payment_status` (`LUNAS`/`DP`/`BELUM_BAYAR`) pada transaksi order terkait secara otomatis.
  - Mencatat jejak aktivitas ke `audit_logs` (`UPDATE_PAYMENT` / `VOID_PAYMENT`).
- **Edit Transaksi Active**:
  - `PATCH /api/v1/orders/{code}` untuk mengubah jenis layanan, berat (kg/gram), dan catatan pada transaksi aktif (`MENUNGGU` atau `DIPROSES`).
  - Perhitungan otomatis `total_amount` dan `payment_status` (`LUNAS`/`DP`/`BELUM_BAYAR`).
  - Pencatatan otomatis ke `audit_logs`.
- **Pengaturan Layanan**:
  - Harga layanan dari database (`G`, `R`, `GR`).

## Endpoint Utama

Auth:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

Dashboard:

- `GET /api/v1/dashboard`

Users:

- `GET /api/v1/users`
- `POST /api/v1/users`
- `GET /api/v1/users/{username}`
- `PATCH /api/v1/users/{username}`
- `POST /api/v1/users/{username}/reset-password`

Customers:

- `GET /api/v1/customers`
- `GET /api/v1/customers/suggestions`
- `GET /api/v1/customers/{id}`
- `PATCH /api/v1/customers/{id}`

Orders:

- `GET /api/v1/orders`
- `POST /api/v1/orders`
- `GET /api/v1/orders/{code}`
- `PATCH /api/v1/orders/{code}`
- `PATCH /api/v1/orders/{code}/status`
- `PATCH /api/v1/orders/bulk-status`
- `DELETE /api/v1/orders/{code}`

Reports:

- `GET /api/v1/reports/overview`
- `GET /api/v1/reports/detail`
- `GET /api/v1/reports/export`

Audit Logs:

- `GET /api/v1/audit-logs`

Settings & Backup:

- `GET /api/v1/settings/profile`
- `PATCH /api/v1/settings/profile`
- `GET /api/v1/settings/backup`

Payments:

- `GET /api/v1/payments`
- `GET /api/v1/payments/{code}`
- `PATCH /api/v1/payments/{code}`
- `DELETE /api/v1/payments/{code}`
- `POST /api/v1/orders/{code}/payments/settle`

Pickup:

- `GET /api/v1/orders/{code}/pickup`
- `POST /api/v1/orders/{code}/pickup`

Uploads:

- `GET /uploads/*`

## Struktur Database Ringkas

- `users`: akun owner/staff.
- `customers`: data pelanggan.
- `services`: layanan `G`, `R`, `GR` dan harga per kg.
- `orders`: transaksi kopi masuk.
- `payments`: pembayaran tunai dan pelunasan.
- `pickups`: bukti serah terima dengan foto.
- `order_status_logs`: riwayat status order.
- `daily_sequences`: nomor urut order harian per layanan.
- `app_settings`: pengaturan aplikasi dan profil toko.
- `audit_logs`: jejak aksi penting.

## Status Aplikasi

Seluruh fitur operasional kasir dan manajemen roasting kopi Patenote telah **100% selesai dibuat** dan siap digunakan. Catatan: Aplikasi berjalan langsung menggunakan binary Go backend dan React frontend build tanpa membutuhkan Docker.

## Catatan Fitur MVP & Roadmap (Phase 2)

Saat ini aplikasi sudah masuk standar **MVP (Minimum Viable Product)** untuk operasional roastery sehari-hari, meliputi kasir, pencatatan produksi, dan penyerahan barang dengan foto bukti.

**Sudah Selesai:**
- **Modul Kas Kecil (Petty Cash):** Pencatatan arus kas keluar harian (listrik, perlengkapan toko, dll), terintegrasi ke ringkasan Kas Bersih di dashboard.

**Pengembangan Selanjutnya (Fitur Prioritas Berikutnya):**
- **Rekonsiliasi Kas / Shift Management:** Buka/tutup shift kasir dengan perhitungan Total Uang Fisik = Kas Masuk - Kas Keluar agar laporan tutup buku lebih akurat.
- **Manajemen Stok / Gudang (Inventory):**
  - Pencatatan stok barang masuk (kopi mentah / green beans).
  - Fitur mutasi stok & perhitungan shrinkage otomatis setelah roasting.
  - Master data supplier & histori pembelian stok.
- **Auto-Print Window:** Pembaruan UI struk thermal untuk bypass tab baru (menggunakan invisible iframe agar dialog print browser langsung terbuka tanpa modal/tab).
