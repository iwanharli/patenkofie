import type { BadgeProps } from '@/components/ui/badge'
import { Badge } from '@/components/ui/badge'
import { formatEnumLabel } from '@/utils/format'

const paymentVariant = {
  BELUM_BAYAR: 'outline',
  DP: 'warning',
  LUNAS: 'success',
} as const

const orderVariant = {
  DIBATALKAN: 'destructive',
  DIPROSES: 'secondary',
  MENUNGGU: 'warning',
  SELESAI: 'success',
  SIAP_DIAMBIL: 'default',
} as const

export function PaymentStatusBadge({ status }: { status: keyof typeof paymentVariant }) {
  return <Badge variant={paymentVariant[status]}>{formatEnumLabel(status)}</Badge>
}

export function OrderStatusBadge({ status }: { status: keyof typeof orderVariant }) {
  return <Badge variant={orderVariant[status] as BadgeProps['variant']}>{formatEnumLabel(status)}</Badge>
}
