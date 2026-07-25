import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardServiceBreakdown } from '@/features/dashboard/dashboardApi'
import { formatRupiah } from '@/utils/format'

export function ServiceBreakdown({ services }: { services: DashboardServiceBreakdown[] }) {
  const maxOrders = Math.max(...services.map((service) => service.order_count), 1)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Volume layanan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {services.map((service) => (
          <div key={service.service_code}>
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-sm font-medium">{service.service_name}</p>
                <p className="text-xs text-muted-foreground">
                  {service.order_count} order · {formatWeight(service.weight_kg)} kg
                </p>
              </div>
              <p className="shrink-0 text-sm font-semibold">{formatRupiah(service.amount)}</p>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.max((service.order_count / maxOrders) * 100, service.order_count > 0 ? 8 : 0)}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function formatWeight(value: string) {
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(Number(value))
}
