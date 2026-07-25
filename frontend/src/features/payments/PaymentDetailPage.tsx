import { ArrowLeft, Printer, ReceiptText } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'

import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { OrderStatusBadge, PaymentStatusBadge } from '@/features/orders/status'
import { fetchPayment, type PaymentRecord } from '@/features/payments/paymentsApi'
import { formatEnumLabel, formatRupiah } from '@/utils/format'

export function PaymentDetailPage() {
  const params = useParams()
  const [payment, setPayment] = useState<PaymentRecord | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(params.paymentCode))

  useEffect(() => {
    let isMounted = true

    if (!params.paymentCode) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    fetchPayment(params.paymentCode)
      .then((item) => {
        if (isMounted) {
          setPayment(item)
        }
      })
      .catch(() => {
        if (isMounted) {
          setPayment(null)
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [params.paymentCode])

  if (isLoading) {
    return <PageHeader description="Memuat bukti pembayaran." eyebrow="Detail pembayaran" title="Memuat..." />
  }

  if (!payment) {
    return (
      <PageHeader
        actions={
          <Button asChild variant="outline">
            <Link to="/payments">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Kembali
            </Link>
          </Button>
        }
        description="Kode pembayaran tidak ditemukan di database."
        eyebrow="Detail pembayaran"
        title="Pembayaran tidak ditemukan"
      />
    )
  }

  return (
    <>
      <PageHeader
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/payments">
                <ArrowLeft aria-hidden="true" className="size-4" />
                Kembali
              </Link>
            </Button>
            <Button variant="outline">
              <Printer aria-hidden="true" className="size-4" />
              Cetak
            </Button>
          </>
        }
        description={`${payment.customer_name} - ${payment.payment_method} - ${formatDate(payment.paid_at)}`}
        eyebrow="Detail pembayaran"
        title={payment.payment_code}
      />

      <section className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>Bukti pembayaran</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Info label="Order" value={payment.order_code} />
            <Info label="Pelanggan" value={payment.customer_name} />
            <Info label="Jenis pembayaran" value={formatEnumLabel(payment.payment_type)} />
            <Info label="Metode" value={payment.payment_method} />
            <Info label="Diterima oleh" value={payment.received_by_name} />
            <Info label="Waktu" value={formatDate(payment.paid_at)} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-md bg-secondary text-secondary-foreground">
                  <ReceiptText aria-hidden="true" className="size-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nominal diterima</p>
                  <p className="text-2xl font-semibold">{formatRupiah(payment.amount)}</p>
                </div>
              </div>
              <Separator className="my-4" />
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Status order</span>
                  <OrderStatusBadge status={payment.order_status} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Status bayar</span>
                  <PaymentStatusBadge status={payment.order_payment_status} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Sisa order</span>
                  <span className="text-sm font-semibold">{formatRupiah(payment.order_remaining)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Catatan</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">{payment.notes ?? 'Tidak ada catatan.'}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild className="flex-1" variant="outline">
                  <Link to={`/orders/${payment.order_code}`}>Buka detail order</Link>
                </Button>
                <Badge variant="secondary">{formatEnumLabel(payment.payment_type)}</Badge>
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
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold leading-6">{value}</p>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
