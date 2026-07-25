import { Banknote, Download, WalletCards } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/common/PageHeader'
import { PaginationBar } from '@/components/common/PaginationBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { fetchPayments, type PaymentRecord } from '@/features/payments/paymentsApi'
import { formatEnumLabel, formatRupiah } from '@/utils/format'

const PAGE_SIZE = 10

interface PaymentSummary {
  cash_today: number
  outstanding_count: number
  outstanding_total: number
  payments_today: number
  total_payments: number
}

export function PaymentsPage() {
  const [page, setPage] = useState(1)
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  const [totalItems, setTotalItems] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    setIsLoading(true)
    setErrorMessage('')
    fetchPayments({ page, pageSize: PAGE_SIZE })
      .then((result) => {
        if (!isMounted) {
          return
        }
        setPayments(result.data)
        setSummary(result.summary)
        setTotalItems(result.meta.total_items)
      })
      .catch(() => {
        if (isMounted) {
          setErrorMessage('Data pembayaran gagal dibaca dari database.')
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
  }, [page])

  return (
    <>
      <PageHeader
        actions={
          <Button variant="outline">
            <Download aria-hidden="true" className="size-4" />
            Ekspor CSV
          </Button>
        }
        description="Ringkasan penerimaan tunai dan transaksi yang masih memiliki sisa pembayaran."
        eyebrow="Kas"
        title="Pembayaran"
      />

      {errorMessage && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-3">
        <Summary icon={Banknote} label="Penerimaan hari ini" value={formatRupiah(summary?.cash_today ?? 0)} />
        <Summary icon={WalletCards} label="Belum lunas aktif" value={formatRupiah(summary?.outstanding_total ?? 0)} />
        <Summary icon={Banknote} label="Pembayaran tercatat" value={`${summary?.total_payments ?? 0} transaksi`} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Riwayat pembayaran tunai</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-border bg-muted/70 text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-5 py-3">Kode bayar</th>
                <th className="px-5 py-3">Order</th>
                <th className="px-5 py-3">Pelanggan</th>
                <th className="px-5 py-3">Jenis</th>
                <th className="px-5 py-3">Jumlah</th>
                <th className="px-5 py-3">Petugas</th>
                <th className="px-5 py-3">Waktu</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="px-5 py-8 text-center text-muted-foreground" colSpan={7}>
                    Memuat pembayaran...
                  </td>
                </tr>
              )}
              {!isLoading && payments.length === 0 && (
                <tr>
                  <td className="px-5 py-8 text-center text-muted-foreground" colSpan={7}>
                    Belum ada pembayaran tercatat.
                  </td>
                </tr>
              )}
              {!isLoading && payments.map((payment) => (
                <tr className="border-b border-border last:border-b-0 hover:bg-muted/35" key={payment.payment_code}>
                  <td className="px-5 py-4 font-medium">
                    <Link className="text-primary hover:underline" to={`/payments/${payment.payment_code}`}>
                      {payment.payment_code}
                    </Link>
                  </td>
                  <td className="px-5 py-4">
                    <Link className="hover:text-primary hover:underline" to={`/orders/${payment.order_code}`}>
                      {payment.order_code}
                    </Link>
                  </td>
                  <td className="px-5 py-4">{payment.customer_name}</td>
                  <td className="px-5 py-4">
                    <Badge variant="secondary">{formatEnumLabel(payment.payment_type)}</Badge>
                  </td>
                  <td className="px-5 py-4 font-semibold">{formatRupiah(payment.amount)}</td>
                  <td className="px-5 py-4">{payment.received_by_name}</td>
                  <td className="px-5 py-4 text-muted-foreground">{formatDate(payment.paid_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
        <PaginationBar
          onPageChange={setPage}
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={totalItems}
        />
      </Card>
    </>
  )
}

function Summary({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Banknote
  label: string
  value: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-5">
        <div className="grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground">
          <Icon aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
