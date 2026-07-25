import { Edit, Phone, Plus } from 'lucide-react'
import { Link, useParams } from 'react-router'

import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { OrderStatusBadge, PaymentStatusBadge } from '@/features/orders/status'
import { customers, orders } from '@/features/shared/mockData'

export function CustomerDetailPage() {
  const params = useParams()
  const customer = customers.find((item) => item.id === params.customerId) ?? customers[0]
  const customerOrders = orders.filter((order) => order.customer === customer.name)

  return (
    <>
      <PageHeader
        actions={
          <>
            <Button variant="outline">
              <Phone aria-hidden="true" className="size-4" />
              Hubungi
            </Button>
            <Button>
              <Plus aria-hidden="true" className="size-4" />
              Transaksi baru
            </Button>
          </>
        }
        description={`${customer.phone} · ${customer.address}`}
        eyebrow="Detail pelanggan"
        title={customer.name}
      />

      <section className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Profil pelanggan</CardTitle>
              <Button size="sm" variant="outline">
                <Edit aria-hidden="true" className="size-4" />
                Ubah
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Nomor telepon" value={customer.phone} />
              <Info label="Alamat" value={customer.address} />
              <Info label="Total order" value={`${customer.orders}`} />
              <Info label="Total volume" value={customer.volume} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Riwayat order</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-y border-border bg-muted/70 text-left text-xs font-semibold uppercase text-muted-foreground">
                    <th className="px-5 py-3">Kode</th>
                    <th className="px-5 py-3">Layanan</th>
                    <th className="px-5 py-3">Berat</th>
                    <th className="px-5 py-3">Total</th>
                    <th className="px-5 py-3">Bayar</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {customerOrders.map((order) => (
                    <tr className="border-b border-border last:border-b-0" key={order.code}>
                      <td className="px-5 py-4 font-medium">
                        <Link className="text-primary hover:underline" to={`/orders/${order.code}`}>
                          {order.code}
                        </Link>
                      </td>
                      <td className="px-5 py-4">{order.serviceName}</td>
                      <td className="px-5 py-4">{order.weight}</td>
                      <td className="px-5 py-4 font-semibold">{order.total}</td>
                      <td className="px-5 py-4">
                        <PaymentStatusBadge status={order.paymentStatus} />
                      </td>
                      <td className="px-5 py-4">
                        <OrderStatusBadge status={order.orderStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ringkasan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Info label="Terakhir order" value={customer.lastOrder} />
              <Separator />
              <Info label="Sisa pembayaran" value={customer.receivable} />
              <Separator />
              <Info label="Catatan" value={customer.notes} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Preferensi mock</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md bg-muted p-3">
                <p className="text-muted-foreground">Roasting</p>
                <p className="font-semibold">Medium</p>
              </div>
              <div className="rounded-md bg-muted p-3">
                <p className="text-muted-foreground">Gilingan</p>
                <p className="font-semibold">Medium</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6">{value}</p>
    </div>
  )
}
