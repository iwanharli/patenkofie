import { cn } from '@/lib/utils'

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
export function formatWeight(value: string) {
  const kgNum = Number(value)
  const gramNum = Math.round(kgNum * 1000)

  const kgStr = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(kgNum)

  const gramStr = new Intl.NumberFormat('id-ID').format(gramNum)

  return `${kgStr} kg (${gramStr} g)`
}

export function WeightText({ className, value }: { className?: string; value: string }) {
  const kgNum = Number(value)
  const gramNum = Math.round(kgNum * 1000)

  const kgStr = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(kgNum)

  const gramStr = new Intl.NumberFormat('id-ID').format(gramNum)

  return (
    <span className={cn('whitespace-nowrap', className)}>
      {kgStr} kg <span className="text-[0.7em] font-normal text-muted-foreground">({gramStr} g)</span>
    </span>
  )
}
