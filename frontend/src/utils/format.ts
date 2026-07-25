const statusLabels: Record<string, string> = {
  BELUM_BAYAR: 'Belum bayar',
  CUSTOMER: 'Pelanggan sendiri',
  DIBATALKAN: 'Dibatalkan',
  DIPROSES: 'Diproses',
  DOWN_PAYMENT: 'DP',
  FULL_PAYMENT: 'Lunas di awal',
  LUNAS: 'Lunas',
  MENUNGGU: 'Menunggu',
  REMAINING_PAYMENT: 'Pelunasan',
  REPRESENTATIVE: 'Perwakilan',
  SELESAI: 'Selesai',
  SIAP_DIAMBIL: 'Siap diambil',
}

export function formatEnumLabel(value: string) {
  return statusLabels[value] ?? value.replaceAll('_', ' ').toLowerCase()
}

export function formatRupiah(value: number) {
  return new Intl.NumberFormat('id-ID', {
    currency: 'IDR',
    maximumFractionDigits: 0,
    style: 'currency',
  })
    .format(value)
    .replace(/\s/g, '')
}
