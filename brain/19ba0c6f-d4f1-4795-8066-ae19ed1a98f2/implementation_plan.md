# Implementasi Fitur Kasir (Petty Cash & Shift Management)

Sistem *Shift Closing* dan Pengeluaran (Petty Cash) adalah kunci agar arus kas di laci kasir bisa diaudit dan tidak terjadi selisih (bocor). Fitur ini akan melengkapi aplikasi agar menjadi POS yang komprehensif.

## User Review Required

> [!IMPORTANT]
> **Keputusan Workflow Kasir:**
> 1. Apakah kasir **wajib** melakukan "Buka Kasir" sebelum bisa mencatat transaksi baru/pembayaran? (Sangat disarankan untuk mencegah pencatatan tanpa penanggung jawab).
> 2. Apakah *Owner* boleh mengedit atau menghapus *shift* kasir yang sudah ditutup, atau sifatnya permanen (hanya bisa dibaca)?

## Open Questions

> [!NOTE]
> Apakah Anda ingin agar resi "Tutup Kasir" (Shift Closing Receipt) juga langsung dicetak ke printer *thermal* saat shift ditutup?

## Proposed Changes

---

### Database Migrations

#### [NEW] `backend/migrations/000004_add_cash_shifts.up.sql`
Membuat dua tabel baru:
- `cash_shifts`: Menyimpan riwayat shift (Buka/Tutup).
  - Kolom: `id`, `user_id`, `status` (`OPEN`, `CLOSED`), `opened_at`, `closed_at`, `starting_cash` (modal awal), `expected_ending_cash`, `actual_ending_cash` (uang fisik laci), `cash_difference` (selisih), `notes`.
- `expenses`: Menyimpan pengeluaran harian (Petty cash).
  - Kolom: `id`, `shift_id` (terikat ke shift kasir yang sedang buka), `amount`, `description`, `expense_date`, `created_by`.

#### [NEW] `backend/migrations/000004_add_cash_shifts.down.sql`
Script rollback untuk menghapus kedua tabel di atas.

---

### Backend (Go API)

#### [NEW] `backend/internal/shift/*`
Membuat modul khusus `shift` yang menangani endpoint:
- `GET /api/v1/shifts/current`: Mengecek apakah staf yang login sedang memiliki shift `OPEN`.
- `POST /api/v1/shifts/open`: Membuka shift dengan memasukkan jumlah `starting_cash` (Modal kembalian).
- `POST /api/v1/shifts/close`: Menutup shift (mengkalkulasi Uang Masuk dari `payments` dan Uang Keluar dari `expenses`, lalu mencocokkan dengan input uang aktual).
- `GET /api/v1/shifts`: Histori shift untuk laporan Owner.

#### [NEW] `backend/internal/expense/*`
Membuat modul `expense` (Petty Cash):
- `POST /api/v1/expenses`: Mencatat uang keluar (lakban, galon, dll).
- `GET /api/v1/expenses`: Melihat daftar uang keluar (difilter berdasarkan tanggal atau shift).

---

### Frontend (React UI)

#### [MODIFY] `frontend/src/app/AppShell.tsx`
- Menambahkan rute halaman `/shift` (Kelola Kasir & Pengeluaran).
- Menambahkan **Shift Indicator** di bagian atas (Topbar). Jika indikator berwarna merah (Tutup), kasir tidak bisa menginput pesanan sampai mereka menekan tombol "Buka Kasir".

#### [NEW] `frontend/src/features/shift/ShiftDashboardPage.tsx`
Halaman pusat kasir yang memuat:
- Status shift saat ini (Buka sejak jam X, Modal Awal Rp Y).
- Tombol **Tutup Kasir** (memunculkan modal konfirmasi input hitungan fisik).
- Daftar Pengeluaran (Petty Cash) untuk shift ini.
- Tombol **+ Catat Pengeluaran**.

#### [NEW] `frontend/src/features/shift/ShiftHistoryPage.tsx`
(Khusus Owner) Daftar riwayat closing shift semua kasir dari hari ke hari.

#### [NEW] `frontend/src/features/shift/ShiftClosingPrintPage.tsx`
Layout *Thermal Print* ukuran 58mm/80mm untuk mencetak "Laporan Tutup Kasir" (End-of-Day Receipt).

## Verification Plan

### Automated Tests
- Tidak diperlukan unit test tambahan, fitur akan langsung diverifikasi di web browser.

### Manual Verification
1. Login sebagai `STAFF`.
2. Halaman akan meminta staf melakukan "Buka Kasir" dengan memasukkan Modal Awal (misal Rp50.000).
3. Buat order baru dan selesaikan pembayaran tunai (misal Rp100.000).
4. Catat pengeluaran beli lakban (Rp15.000).
5. Lakukan "Tutup Kasir". Sistem akan memprediksi uang di laci: `50k + 100k - 15k = Rp135.000`.
6. Kasir menginput jumlah uang fisik yang mereka hitung. Jika diinput `Rp130.000`, maka tercatat selisih minus `-Rp5.000`.
7. Resi penutupan berhasil dicetak.
