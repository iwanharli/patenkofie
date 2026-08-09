# Changelog

Semua perubahan penting pada proyek ini dicatat di file ini.

## [Unreleased]

### Added
- Cetak struk langsung dari halaman transaksi/pembayaran lewat frame tersembunyi: dialog cetak browser terbuka di atas halaman, tanpa membuka tab baru lebih dulu.
- Modul Kas Kecil (Petty Cash): pencatatan pengeluaran harian dengan kategori, filter rentang tanggal, dan pagination. Total pengeluaran terintegrasi ke ringkasan Kas Bersih di dashboard.
- Panduan pairing/instalasi printer thermal 58mm langsung di halaman cetak struk.
- Guard `RequireOwner` di level route frontend untuk semua halaman owner-only (Harga Layanan, Profil Toko, Pengguna, Audit Log) — sebelumnya status owner-only hanya disembunyikan di sidebar, bukan diblokir di route.

### Changed
- Autentikasi dan pengecekan role dipusatkan di middleware (`auth.RequireAuth` / `auth.RequireOwner`). Peta otorisasi seluruh aplikasi kini terbaca di satu tempat: pengelompokan route di `backend/cmd/server/main.go`. Handler tidak lagi membaca cookie sendiri maupun mengulang query `IsOwner`.
- Menonaktifkan akun atau mengubah rolenya kini langsung berlaku pada sesi yang sedang berjalan, tidak menunggu sesi 8 jam berakhir.

### Fixed
- Detail transaksi tidak pernah mengirim `created_by_name`, `picked_up_by_name`, dan `status_logs` meski datanya sudah diambil dari database. Akibatnya "Petugas Penerima" dan "Kasir" di struk selalu tertulis "Sistem", "Petugas Serah Terima" selalu "Belum diambil", dan panel Riwayat Perubahan Status selalu kosong.
- Riwayat perubahan status selalu kosong untuk semua transaksi: `previous_status` bernilai NULL pada entri pertama, gagal di-scan ke `string`, dan errornya ditelan diam-diam sehingga barisnya dilewati. Query kini meng-COALESCE kolom tersebut dan error scan tidak lagi diabaikan.
- Ukuran kertas cetak (`@page`) yang sebelumnya global 90mm x 60mm (dibuat untuk label) ikut memaksa struk ke ukuran label. Kini aturan itu spesifik per halaman: label tetap 90mm x 60mm, sedangkan struk menyerahkan ukuran kertas ke driver printer (kertas roll 58mm) dengan isi struk dibatasi 58mm. Catatan: `@page { size: 58mm auto }` bukan CSS valid dan diabaikan browser, jadi tidak dipakai.
- `PATCH /api/v1/services/{code}` (ubah harga layanan) kini mewajibkan role OWNER — sebelumnya bisa diakses STAFF mana pun yang login.
- `PATCH/DELETE /api/v1/expenses/{id}` kini mewajibkan role OWNER, konsisten dengan modul payment.
