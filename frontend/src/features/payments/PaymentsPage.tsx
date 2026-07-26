import { ArrowDownAZ, ArrowUpRight, Banknote, Clock3, ReceiptText, RotateCcw, Search, WalletCards } from 'lucide-react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { PageHeader } from '@/components/common/PageHeader'
import { PaginationBar } from '@/components/common/PaginationBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { OrderStatusBadge, PaymentStatusBadge } from '@/features/orders/status'
import { fetchPayments, type PaymentListRecord } from '@/features/payments/paymentsApi'
import { formatEnumLabel, formatRupiah } from '@/utils/format'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PAGE_SIZE = 10
const rowTypeOptions = [
  { label: 'Semua baris', value: 'ALL' },
  { label: 'Bukti pembayaran', value: 'PAYMENT' },
  { label: 'Tagihan belum bayar', value: 'UNPAID_ORDER' },
]
const paymentTypeOptions = [
  { label: 'Semua jenis', value: 'ALL' },
  { label: 'Lunas di awal', value: 'FULL_PAYMENT' },
  { label: 'DP', value: 'DOWN_PAYMENT' },
  { label: 'Pelunasan', value: 'REMAINING_PAYMENT' },
  { label: 'Belum bayar', value: 'UNPAID_ORDER' },
]
const paymentStatusOptions = [
  { label: 'Semua bayar', value: 'ALL' },
  { label: 'Belum bayar', value: 'BELUM_BAYAR' },
  { label: 'DP', value: 'DP' },
  { label: 'Lunas', value: 'LUNAS' },
]
const orderStatusOptions = [
  { label: 'Semua produksi', value: 'ALL' },
  { label: 'Menunggu', value: 'MENUNGGU' },
  { label: 'Diproses', value: 'DIPROSES' },
  { label: 'Siap diambil', value: 'SIAP_DIAMBIL' },
  { label: 'Selesai', value: 'SELESAI' },
  { label: 'Dibatalkan', value: 'DIBATALKAN' },
]
const sortOptions = [
  { label: 'Terbaru', sortBy: 'time', sortDirection: 'DESC', value: 'time:DESC' },
  { label: 'Terlama', sortBy: 'time', sortDirection: 'ASC', value: 'time:ASC' },
  { label: 'Jumlah tertinggi', sortBy: 'amount', sortDirection: 'DESC', value: 'amount:DESC' },
  { label: 'Jumlah terendah', sortBy: 'amount', sortDirection: 'ASC', value: 'amount:ASC' },
  { label: 'Bukti/Order A-Z', sortBy: 'code', sortDirection: 'ASC', value: 'code:ASC' },
  { label: 'Bukti/Order Z-A', sortBy: 'code', sortDirection: 'DESC', value: 'code:DESC' },
  { label: 'Pelanggan A-Z', sortBy: 'customer', sortDirection: 'ASC', value: 'customer:ASC' },
  { label: 'Pelanggan Z-A', sortBy: 'customer', sortDirection: 'DESC', value: 'customer:DESC' },
]

interface PaymentSummary {
  cash_today: number
  outstanding_count: number
  outstanding_total: number
  payments_today: number
  total_payments: number
}

export function PaymentsPage() {
  const [page, setPage] = useState(1)
  const [payments, setPayments] = useState<PaymentListRecord[]>([])
  const [summary, setSummary] = useState<PaymentSummary | null>(null)
  const [totalItems, setTotalItems] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [rowType, setRowType] = useState('ALL')
  const [paymentType, setPaymentType] = useState('ALL')
  const [paymentStatus, setPaymentStatus] = useState('ALL')
  const [orderStatus, setOrderStatus] = useState('ALL')
  const [sortValue, setSortValue] = useState('time:DESC')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const selectedSort = sortOptions.find((option) => option.value === sortValue) ?? sortOptions[0]

  useEffect(() => {
    const timeoutID = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
      setPage(1)
    }, 250)

    return () => window.clearTimeout(timeoutID)
  }, [searchTerm])

  useEffect(() => {
    let isMounted = true

    setIsLoading(true)
    setErrorMessage('')
    fetchPayments({
      orderStatus,
      page,
      pageSize: PAGE_SIZE,
      paymentStatus,
      paymentType,
      rowType,
      search: debouncedSearchTerm,
      sortBy: selectedSort.sortBy,
      sortDirection: selectedSort.sortDirection as 'ASC' | 'DESC',
    })
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
  }, [debouncedSearchTerm, orderStatus, page, paymentStatus, paymentType, rowType, selectedSort.sortBy, selectedSort.sortDirection])

  function resetFilters() {
    setSearchTerm('')
    setDebouncedSearchTerm('')
    setRowType('ALL')
    setPaymentType('ALL')
    setPaymentStatus('ALL')
    setOrderStatus('ALL')
    setSortValue('time:DESC')
    setPage(1)
  }

  function handleFilterChange(setter: (value: string) => void) {
    return (value: string) => {
      setter(value)
      setPage(1)
    }
  }

  return (
    <>
      <PageHeader
        description="Ringkasan penerimaan tunai dan transaksi yang masih memiliki sisa pembayaran."
        eyebrow="Kas"
        title="Pembayaran"
      />

      {errorMessage && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-3">
        <Summary
          detail={`${summary?.payments_today ?? 0} pembayaran hari ini`}
          icon={Banknote}
          label="Penerimaan hari ini"
          tone="green"
          value={formatRupiah(summary?.cash_today ?? 0)}
        />
        <Summary
          detail={`${summary?.outstanding_count ?? 0} order aktif belum lunas`}
          icon={WalletCards}
          label="Sisa pembayaran"
          tone="amber"
          value={formatRupiah(summary?.outstanding_total ?? 0)}
        />
        <Summary
          detail="Bukti kas tersimpan terpisah dari tagihan"
          icon={ReceiptText}
          label="Pembayaran tercatat"
          tone="blue"
          value={`${summary?.total_payments ?? 0} transaksi`}
        />
      </section>

      <Card>
        <CardHeader className="gap-1">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <CardTitle>Pembayaran dan tagihan tunai</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Klik baris atau tombol detail untuk membuka bukti pembayaran atau order yang belum dibayar.
              </p>
            </div>
            <div className="relative w-full xl:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Cari bukti, order, atau pelanggan"
                value={searchTerm}
              />
            </div>
          </div>

          <div className="grid gap-2 pt-3 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1fr_1.2fr_auto]">
            <FilterSelect label="Baris" onValueChange={handleFilterChange(setRowType)} options={rowTypeOptions} value={rowType} />
            <FilterSelect label="Jenis" onValueChange={handleFilterChange(setPaymentType)} options={paymentTypeOptions} value={paymentType} />
            <FilterSelect label="Pembayaran" onValueChange={handleFilterChange(setPaymentStatus)} options={paymentStatusOptions} value={paymentStatus} />
            <FilterSelect label="Produksi" onValueChange={handleFilterChange(setOrderStatus)} options={orderStatusOptions} value={orderStatus} />
            <FilterSelect
              label="Urutkan"
              onValueChange={(value) => {
                setSortValue(value)
                setPage(1)
              }}
              options={sortOptions}
              value={sortValue}
            />
            <Button className="h-10 self-end" onClick={resetFilters} type="button" variant="outline">
              <RotateCcw aria-hidden="true" className="size-4" />
              Reset
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <PaymentLoadingState />
          ) : payments.length === 0 ? (
            <PaymentEmptyState />
          ) : (
            <>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[980px] border-collapse text-sm">
                  <thead>
                    <tr className="border-y border-border bg-muted/70 text-left text-xs font-semibold uppercase text-muted-foreground">
                      <th className="px-5 py-3 whitespace-nowrap">Bukti</th>
                      <th className="px-5 py-3 whitespace-nowrap">Order</th>
                      <th className="px-5 py-3">Pelanggan</th>
                      <th className="px-5 py-3">Jenis</th>
                      <th className="px-5 py-3 text-right">Jumlah</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Waktu</th>
                      <th className="px-5 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((payment) => (
                      <PaymentTableRow key={paymentRowKey(payment)} payment={payment} />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid gap-3 p-4 md:hidden">
                {payments.map((payment) => (
                  <PaymentMobileCard key={paymentRowKey(payment)} payment={payment} />
                ))}
              </div>
            </>
          )}
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
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: {
  detail: string
  icon: typeof Banknote
  label: string
  tone: 'amber' | 'blue' | 'green'
  value: string
}) {
  const toneClass = {
    amber: 'bg-warning/20 text-warning-foreground',
    blue: 'bg-accent text-accent-foreground',
    green: 'bg-success/10 text-success',
  }[tone]

  return (
    <Card>
      <CardContent className="flex min-h-32 items-center gap-4 p-5">
        <div className={`grid size-11 shrink-0 place-items-center rounded-md ${toneClass}`}>
          <Icon aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 truncate text-2xl font-semibold tracking-normal">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function FilterSelect({
  label,
  onValueChange,
  options,
  value,
}: {
  label: string
  onValueChange: (value: string) => void
  options: Array<{ label: string; value: string }>
  value: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
        {label === 'Urutkan' && <ArrowDownAZ aria-hidden="true" className="size-3.5" />}
        <span>{label}</span>
      </div>
      <Select onValueChange={onValueChange} value={value}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function PaymentTableRow({ payment }: { payment: PaymentListRecord }) {
  const navigate = useNavigate()
  const isUnpaidOrder = payment.row_type === 'UNPAID_ORDER'
  const detailPath = isUnpaidOrder ? `/orders/${payment.order_code}` : `/payments/${payment.payment_code}`
  const amount = isUnpaidOrder ? payment.order_remaining : payment.amount
  const detailLabel = isUnpaidOrder
    ? `Buka detail order ${payment.order_code}`
    : `Buka detail pembayaran ${payment.payment_code}`

  function openDetail() {
    navigate(detailPath)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      openDetail()
    }
  }

  function stopRowNavigation(event: MouseEvent<HTMLAnchorElement>) {
    event.stopPropagation()
  }

  return (
    <tr
      aria-label={detailLabel}
      className="group cursor-pointer border-b border-border last:border-b-0 hover:bg-muted/35 focus-visible:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      onClick={openDetail}
      onKeyDown={handleKeyDown}
      role="link"
      tabIndex={0}
    >
      <td className="whitespace-nowrap px-5 py-4 align-top">
        {isUnpaidOrder ? (
          <p className="font-semibold text-warning-foreground">Belum ada bukti</p>
        ) : (
          <Link
            aria-label={`Buka detail pembayaran ${payment.payment_code}`}
            className="block rounded-sm font-semibold text-primary outline-none ring-ring transition-colors hover:underline focus-visible:ring-2"
            to={detailPath}
          >
            {payment.payment_code}
          </Link>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{payment.payment_method ?? 'Belum ada pembayaran'}</p>
      </td>
      <td className="whitespace-nowrap px-5 py-4 align-top">
        <Link
          className="font-medium hover:text-primary hover:underline"
          onClick={stopRowNavigation}
          to={`/orders/${payment.order_code}`}
        >
          {payment.order_code}
        </Link>
        <p className="mt-1 text-xs text-muted-foreground">
          {payment.received_by_name ? `oleh ${payment.received_by_name}` : 'tagihan belum dibayar'}
        </p>
      </td>
      <td className="px-5 py-4 align-top">
        <p className="font-medium">{payment.customer_name}</p>
      </td>
      <td className="px-5 py-4 align-top">
        <Badge variant={isUnpaidOrder ? 'outline' : 'secondary'}>
          {isUnpaidOrder ? 'Belum bayar' : formatEnumLabel(payment.payment_type)}
        </Badge>
      </td>
      <td className="px-5 py-4 text-right align-top">
        <p className="font-semibold">{formatRupiah(amount)}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {isUnpaidOrder ? `Total ${formatRupiah(payment.order_total)}` : `Sisa ${formatRupiah(payment.order_remaining)}`}
        </p>
      </td>
      <td className="px-5 py-4 align-top">
        <div className="flex flex-col items-start gap-2">
          <PaymentStatusBadge status={payment.order_payment_status} />
          <OrderStatusBadge status={payment.order_status} />
        </div>
      </td>
      <td className="px-5 py-4 align-top text-muted-foreground">
        <div className="flex items-center gap-2">
          <Clock3 aria-hidden="true" className="size-4" />
          <span>{formatDate(payment.paid_at)}</span>
        </div>
      </td>
      <td className="px-5 py-4 text-right align-top">
        <Button asChild size="sm" variant="outline">
          <Link to={detailPath}>
            {isUnpaidOrder ? 'Order' : 'Detail'}
            <ArrowUpRight aria-hidden="true" className="size-4" />
          </Link>
        </Button>
      </td>
    </tr>
  )
}

function PaymentMobileCard({ payment }: { payment: PaymentListRecord }) {
  const isUnpaidOrder = payment.row_type === 'UNPAID_ORDER'
  const detailPath = isUnpaidOrder ? `/orders/${payment.order_code}` : `/payments/${payment.payment_code}`
  const amount = isUnpaidOrder ? payment.order_remaining : payment.amount

  return (
    <Link
      className="block rounded-md border border-border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      to={detailPath}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-primary">{payment.payment_code ?? payment.order_code}</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">{payment.customer_name}</p>
        </div>
        <Badge variant={isUnpaidOrder ? 'outline' : 'secondary'}>
          {isUnpaidOrder ? 'Belum bayar' : formatEnumLabel(payment.payment_type)}
        </Badge>
      </div>
      <p className="mt-4 text-2xl font-semibold">{formatRupiah(amount)}</p>
      {isUnpaidOrder && <p className="mt-1 text-xs text-muted-foreground">Belum ada bukti pembayaran</p>}
      <div className="mt-4 flex flex-wrap gap-2">
        <PaymentStatusBadge status={payment.order_payment_status} />
        <OrderStatusBadge status={payment.order_status} />
      </div>
      <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
        <div className="flex items-center justify-between gap-3">
          <span>Order</span>
          <span className="font-medium text-foreground">{payment.order_code}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Petugas</span>
          <span className="font-medium text-foreground">{payment.received_by_name ?? '-'}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Waktu</span>
          <span className="text-right font-medium text-foreground">{formatDate(payment.paid_at)}</span>
        </div>
      </div>
    </Link>
  )
}

function PaymentLoadingState() {
  return (
    <div className="grid gap-3 p-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <div className="rounded-md border border-border p-4" key={index}>
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="mt-3 h-7 w-44 rounded bg-muted" />
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="h-3 rounded bg-muted" />
            <div className="h-3 rounded bg-muted" />
            <div className="h-3 rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  )
}

function PaymentEmptyState() {
  return (
    <div className="grid min-h-56 place-items-center px-4 py-12 text-center">
      <div>
        <div className="mx-auto grid size-12 place-items-center rounded-md bg-secondary text-secondary-foreground">
          <ReceiptText aria-hidden="true" className="size-6" />
        </div>
        <p className="mt-4 font-semibold">Belum ada pembayaran atau tagihan tercatat.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Pembayaran dan tagihan akan muncul setelah transaksi dibuat.
        </p>
      </div>
    </div>
  )
}

function paymentRowKey(payment: PaymentListRecord) {
  return `${payment.row_type}-${payment.payment_code ?? payment.order_code}`
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
