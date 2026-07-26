import { ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardRecentOrder } from '@/features/dashboard/dashboardApi'
import { OrderStatusBadge, PaymentStatusBadge } from '@/features/orders/status'
import { cn } from '@/lib/utils'
import { formatRupiah, WeightText } from '@/utils/format'

export function RecentOrdersTable({ className, orders }: { className?: string; orders: DashboardRecentOrder[] }) {
  const navigate = useNavigate()

  function openOrderDetail(orderCode: string) {
    navigate(`/orders/${orderCode}`)
  }

  return (
    <Card className={cn('flex h-full flex-col overflow-hidden', className)}>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>Transaksi terbaru</CardTitle>
        <Button asChild size="sm" variant="outline">
          <Link to="/orders">
            Semua
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col overflow-hidden p-0">
        <div className="hidden flex-1 overflow-auto md:block [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full min-w-[500px] border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-y border-border bg-muted text-left text-xs font-semibold uppercase text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]">
              <th className="px-5 py-3">Order</th>
              <th className="px-5 py-3">Layanan</th>
              <th className="px-5 py-3">Berat</th>
              <th className="px-5 py-3">Total</th>
              <th className="px-5 py-3">Bayar</th>
              <th className="px-5 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td className="px-5 py-8 text-center text-muted-foreground" colSpan={6}>
                  Belum ada transaksi.
                </td>
              </tr>
            )}
            {orders.map((order) => (
              <tr
                className="cursor-pointer border-b border-border transition-colors last:border-b-0 hover:bg-muted/45 focus-visible:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                key={order.order_code}
                onClick={() => openOrderDetail(order.order_code)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    openOrderDetail(order.order_code)
                  }
                }}
                role="link"
                tabIndex={0}
              >
                <td className="px-5 py-4">
                  <p className="font-semibold text-primary">{order.order_code}</p>
                  <p className="mt-0.5 truncate text-sm">{order.customer_name}</p>
                </td>
                <td className="px-5 py-4">{order.service_code}</td>
                <td className="px-5 py-4"><WeightText value={order.weight_kg} /></td>
                <td className="px-5 py-4 font-medium">{formatRupiah(order.total_amount)}</td>
                <td className="px-5 py-4">
                  <PaymentStatusBadge status={order.payment_status} />
                </td>
                <td className="px-5 py-4">
                  <OrderStatusBadge status={order.order_status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-auto p-4 md:hidden">
          {orders.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">Belum ada transaksi.</div>
          )}
          {orders.map((order) => (
            <div
              className="flex cursor-pointer flex-col gap-3 rounded-md border border-border bg-background p-4 transition-colors hover:bg-muted/45 focus-visible:bg-muted/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              key={order.order_code}
              onClick={() => openOrderDetail(order.order_code)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  openOrderDetail(order.order_code)
                }
              }}
              role="link"
              tabIndex={0}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-primary">{order.order_code}</p>
                  <p className="mt-1 truncate text-sm font-medium">{order.customer_name}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">{formatRupiah(order.total_amount)}</p>
                  <p className="mt-1 text-xs text-muted-foreground"><WeightText value={order.weight_kg} /></p>
                </div>
              </div>
              <div className="mt-1 flex flex-wrap gap-2">
                <PaymentStatusBadge status={order.payment_status} />
                <OrderStatusBadge status={order.order_status} />
              </div>
              <p className="text-xs text-muted-foreground">{order.service_code}</p>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="mt-auto justify-between border-t border-border bg-muted/35 px-5 py-3 text-xs text-muted-foreground">
        <span>Menampilkan {orders.length} transaksi terakhir</span>
        <Link className="font-medium text-primary hover:underline" to="/orders">
          Kelola transaksi
        </Link>
      </CardFooter>
    </Card>
  )
}


