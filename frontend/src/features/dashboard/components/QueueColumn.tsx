import { Clock3, PackageCheck, Timer } from 'lucide-react'
import { Link } from 'react-router'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardQueue } from '@/features/dashboard/dashboardApi'
import { cn } from '@/lib/utils'
import { formatEnumLabel } from '@/utils/format'

const queueConfig = {
  DIPROSES: {
    color: 'bg-[#3f7eb3]',
    icon: Timer,
  },
  MENUNGGU: {
    color: 'bg-[#f4c84a]',
    icon: Clock3,
  },
  SIAP_DIAMBIL: {
    color: 'bg-[#1f7a4d]',
    icon: PackageCheck,
  },
} as const

interface QueueColumnProps extends DashboardQueue {
  className?: string
}

export function QueueColumn({ className, count, orders, status }: QueueColumnProps) {
  const config = queueConfig[status]
  const Icon = config.icon

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="p-4 pb-2">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn('size-2.5 rounded-full', config.color)} />
            <CardTitle className="truncate text-sm">{formatEnumLabel(status)}</CardTitle>
          </div>
          <div className="flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-semibold">
            <Icon aria-hidden="true" className="size-3.5" />
            {count}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-2">
        {orders.length === 0 && (
          <div className="rounded-md border border-dashed border-border bg-background px-3 py-4 text-center text-xs text-muted-foreground">
            Tidak ada antrean
          </div>
        )}
        {orders.map((order) => (
          <Link
            className="block rounded-md border border-border bg-background px-3 py-2 transition-colors hover:bg-accent"
            key={order.order_code}
            to={`/orders/${order.order_code}`}
          >
            <p className="truncate text-sm font-medium">{order.order_code}</p>
            <p className="truncate text-xs text-muted-foreground">{order.customer_name}</p>
          </Link>
        ))}
        {count > orders.length && (
          <p className="px-1 text-xs font-medium text-muted-foreground">+{count - orders.length} transaksi lain</p>
        )}
      </CardContent>
    </Card>
  )
}
