import { CircleDollarSign, PackageCheck, Timer } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardActivity } from '@/features/dashboard/dashboardApi'
import { formatEnumLabel } from '@/utils/format'

const activityIcons = {
  DIBATALKAN: CircleDollarSign,
  DIPROSES: Timer,
  MENUNGGU: CircleDollarSign,
  SELESAI: PackageCheck,
  SIAP_DIAMBIL: PackageCheck,
} as const

export function ActivityTimeline({ items }: { items: DashboardActivity[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Aktivitas hari ini</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.length === 0 && (
          <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Belum ada aktivitas hari ini.
          </div>
        )}
        {items.map((item) => {
          const Icon = activityIcons[item.status]

          return (
            <div className="flex gap-3" key={`${item.changed_at}-${item.order_code}-${item.status}`}>
              <div className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground">
                <Icon aria-hidden="true" className="size-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium">{item.order_code} {formatEnumLabel(item.status).toLowerCase()}</p>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatTime(item.changed_at)}</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.customer_name}{item.notes ? `, ${item.notes}` : ''}
                </p>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
