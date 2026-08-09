# Changelog

Semua perubahan penting pada proyek ini dicatat di file ini.

## [Unreleased]

### Added
- Modul Kas Kecil (Petty Cash): pencatatan pengeluaran harian dengan kategori, filter rentang tanggal, dan pagination. Total pengeluaran terintegrasi ke ringkasan Kas Bersih di dashboard.
- Panduan pairing/instalasi printer thermal 58mm langsung di halaman cetak struk.
- Guard `RequireOwner` di level route frontend untuk semua halaman owner-only (Harga Layanan, Profil Toko, Pengguna, Audit Log) — sebelumnya status owner-only hanya disembunyikan di sidebar, bukan diblokir di route.

### Fixed
- Ukuran kertas cetak struk thermal (`@page`) yang sebelumnya global 90mm x 60mm (dibuat untuk label) kini spesifik per halaman: label tetap 90mm x 60mm, struk 58mm dengan tinggi otomatis.
- `PATCH /api/v1/services/{code}` (ubah harga layanan) kini mewajibkan role OWNER — sebelumnya bisa diakses STAFF mana pun yang login.
- `PATCH/DELETE /api/v1/expenses/{id}` kini mewajibkan role OWNER, konsisten dengan modul payment.
