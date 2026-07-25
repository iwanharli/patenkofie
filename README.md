# PatenAndum

PatenAndum adalah aplikasi operasional untuk layanan kopi masuk, penggilingan, roasting, pembayaran tunai, QR label, dan serah terima order dengan bukti foto.

## Stack

- Frontend: React, TypeScript, Vite, Tailwind CSS, Radix UI, Lucide icons.
- Backend: Go, Chi router, pgx PostgreSQL, zerolog.
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

- Login dan proteksi halaman berbasis session cookie.
- Layout admin dengan sidebar collapse, topbar, profile dropdown, modal, dan toast global.
- Dashboard data asli dari database:
  - Metrik transaksi, berat kopi, kas tunai, dan sisa pembayaran.
  - Rentang tanggal `Dari` dan `Sampai`.
  - Antrean order aktif.
  - Transaksi terbaru dengan scroll tersembunyi dan klik ke detail.
  - Volume layanan.
  - Aktivitas hari ini.
- Transaksi:
  - Daftar transaksi dari database.
  - Filter, sort, pagination 10 per halaman.
  - Buat transaksi baru.
  - Input berat dalam kilogram atau gram.
  - Saran pelanggan dari data tersimpan.
  - Detail transaksi.
  - Update status single dan bulk.
  - Bulk update hanya untuk status awal yang sama.
  - Hapus transaksi khusus OWNER.
- Pembayaran:
  - Daftar pembayaran tunai dari database.
  - Detail bukti pembayaran.
  - Pelunasan order dari detail transaksi.
  - Pelunasan otomatis membuat record `payments` dan mengubah status bayar menjadi `LUNAS`.
- QR dan label:
  - Halaman cetak label order dengan QR.
  - Link scan QR sudah tersedia.
- Serah terima:
  - Halaman pickup per transaksi.
  - Kamera langsung fullscreen.
  - Upload file fallback.
  - Foto wajib ketika order diselesaikan.
  - Foto dikompres sebelum disimpan sebagai JPEG.
  - Batas dimensi foto tersimpan maksimal 1600px.
- Pengaturan layanan:
  - Harga layanan dari database.
  - Detail layanan.

## Endpoint Utama

Auth:

- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

Dashboard:

- `GET /api/v1/dashboard`
- `GET /api/v1/dashboard?start_date=2026-07-26&end_date=2026-07-26`

Services:

- `GET /api/v1/services`
- `GET /api/v1/services/{code}`

Customers:

- `GET /api/v1/customers/suggestions`

Orders:

- `GET /api/v1/orders`
- `POST /api/v1/orders`
- `GET /api/v1/orders/{code}`
- `PATCH /api/v1/orders/{code}/status`
- `PATCH /api/v1/orders/bulk-status`
- `DELETE /api/v1/orders/{code}`

Payments:

- `GET /api/v1/payments`
- `GET /api/v1/payments/{code}`
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
- `app_settings`: pengaturan aplikasi.
- `audit_logs`: jejak aksi penting.

## Catatan Desain Workflow

- Status order `SELESAI` tidak bisa diubah langsung dari detail transaksi.
- Untuk menyelesaikan order, gunakan halaman serah terima agar foto bukti tercatat.
- Foto pickup diterima sebagai JPG, PNG, atau WebP, lalu disimpan sebagai JPEG kualitas 85.
- Kode pembayaran saat ini virtual dari ID, format `PAY-000001`, karena tabel `payments` belum memiliki kolom kode fisik.

## Fitur Yang Belum Dibuat

- Scan QR nyata dengan kamera untuk membuka detail order atau pickup.
- Halaman pelanggan real penuh:
  - daftar dari database,
  - detail pelanggan,
  - riwayat transaksi,
  - total berat dan total belanja.
- Laporan real:
  - transaksi harian/mingguan/bulanan,
  - kas,
  - piutang,
  - volume layanan,
  - ekspor CSV/PDF.
- Manajemen pengguna:
  - tambah petugas,
  - reset password,
  - nonaktifkan akun,
  - pembatasan akses per role.
- Audit log viewer untuk OWNER.
- Koreksi pembayaran atau pembatalan pembayaran.
- Edit transaksi setelah dibuat.
- Pengaturan profil bisnis dan nota/label cetak.
- Backup dan restore database dari UI.
- Deployment production.

## Catatan Pengembangan

- Jangan menghapus file upload tanpa memastikan record `pickups` terkait sudah tidak dipakai.
- Jalankan `go test ./...`, `npm run lint`, dan `npm run build` sebelum menyelesaikan perubahan besar.
- Setelah menjalankan `npm run build` untuk verifikasi lokal, folder `frontend/dist` boleh dibersihkan jika tidak sedang dibutuhkan untuk preview produksi.
