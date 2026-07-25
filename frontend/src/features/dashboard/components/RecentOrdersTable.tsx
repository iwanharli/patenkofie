import { ArrowRight } from 'lucide-react'
import { Link, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import type { DashboardRecentOrder } from '@/features/dashboard/dashboardApi'
import { OrderStatusBadge, PaymentStatusBadge } from '@/features/orders/status'
import { cn } from '@/lib/utils'
import { formatRupiah } from '@/utils/format'

export function RecentOrdersTable({ className, orders }: { className?: string; orders: DashboardRecentOrder[] }) {
  const navigate = useNavigate()

  function openOrderDetail(orderCode: string) {
    navigate(`/orders/${orderCode}`)
  }

  return (
    <Card className={cn('flex min-h-0 flex-col overflow-hidden', className)}>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle>Transaksi terbaru</CardTitle>
        <Button asChild size="sm" variant="outline">
          <Link to="/orders">
            Semua
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="max-h-[34rem] min-h-0 flex-1 overflow-auto p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-y border-border bg-muted text-left text-xs font-semibold uppercase text-muted-foreground shadow-[0_1px_0_hsl(var(--border))]">
              <th className="px-5 py-3">Kode</th>
              <th className="px-5 py-3">Pelanggan</th>
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
                <td className="px-5 py-8 text-center text-muted-foreground" colSpan={7}>
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
                <td className="whitespace-nowrap px-5 py-4 font-medium">
                  <span className="hover:text-primary hover:underline">{order.order_code}</span>
                </td>
                <td className="px-5 py-4">{order.customer_name}</td>
                <td className="px-5 py-4">{order.service_code}</td>
                <td className="px-5 py-4">{formatWeight(order.weight_kg)} kg</td>
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

function formatWeight(value: string) {
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(Number(value))
}
