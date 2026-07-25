import { Banknote, CalendarDays, QrCode, Scale, ShoppingBag, WalletCards } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ActivityTimeline } from '@/features/dashboard/components/ActivityTimeline'
import { MetricCard } from '@/features/dashboard/components/MetricCard'
import { QueueColumn } from '@/features/dashboard/components/QueueColumn'
import { RecentOrdersTable } from '@/features/dashboard/components/RecentOrdersTable'
import { ServiceBreakdown } from '@/features/dashboard/components/ServiceBreakdown'
import { fetchDashboardOverview, type DashboardOverview } from '@/features/dashboard/dashboardApi'
import { formatRupiah } from '@/utils/format'

export function DashboardPage() {
  const todayInputValue = getTodayInputValue()
  const [startDate, setStartDate] = useState(todayInputValue)
  const [endDate, setEndDate] = useState(todayInputValue)
  const [dashboard, setDashboard] = useState<DashboardOverview | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    if (startDate > endDate) {
      setErrorMessage('Tanggal akhir tidak boleh sebelum tanggal mulai.')
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setErrorMessage('')

    fetchDashboardOverview({ endDate, startDate })
      .then((data) => {
        if (isMounted) {
          setDashboard(data)
        }
      })
      .catch(() => {
        if (isMounted) {
          setErrorMessage('Dashboard gagal dibaca dari database.')
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
  }, [endDate, startDate])

  const metrics = useMemo(() => {
    if (!dashboard) {
      return []
    }

    const transactionDelta = dashboard.summary.transactions_today - dashboard.summary.transactions_previous

    return [
      {
        detail: `${formatSignedNumber(transactionDelta)} dari periode sebelumnya`,
        icon: ShoppingBag,
        label: 'Transaksi periode ini',
        tone: 'green',
        value: String(dashboard.summary.transactions_today),
      },
      {
        detail: 'Total berat masuk hari ini',
        icon: Scale,
        label: 'Kopi masuk',
        tone: 'blue',
        value: `${formatWeight(dashboard.summary.coffee_weight_today_kg)} kg`,
      },
      {
        detail: `${dashboard.summary.cash_payments_today} pembayaran tercatat`,
        icon: Banknote,
        label: 'Kas tunai',
        tone: 'amber',
        value: formatCompactRupiah(dashboard.summary.cash_amount_today),
      },
      {
        detail: `${dashboard.summary.outstanding_orders_active} order aktif`,
        icon: WalletCards,
        label: 'Sisa pembayaran',
        tone: 'red',
        value: formatCompactRupiah(dashboard.summary.outstanding_amount_active),
      },
    ] as const
  }, [dashboard])

  return (
    <>
      <PageHeader
        actions={
          <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-[auto_auto_auto]">
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                const today = getTodayInputValue()
                setStartDate(today)
                setEndDate(today)
              }}
              type="button"
              variant="outline"
            >
              <CalendarDays aria-hidden="true" className="size-4" />
              Hari ini
            </Button>
            <DateInput label="Dari" onChange={setStartDate} value={startDate} />
            <DateInput label="Sampai" onChange={setEndDate} value={endDate} />
          </div>
        }
        description="Ringkasan operasional harian dari transaksi, pembayaran, dan antrean produksi."
        eyebrow={dashboard ? formatDateRange(dashboard.date_range.start_date, dashboard.date_range.end_date) : 'Operasional'}
        title="Dashboard admin"
      />

      {errorMessage && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      )}

      {isLoading && !dashboard ? (
        <DashboardSkeleton />
      ) : dashboard ? (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </section>

          <section className="grid items-stretch gap-4 xl:grid-cols-[1.45fr_0.8fr]">
            <div className="flex min-h-0 flex-col gap-4">
              <div className="grid gap-4 md:grid-cols-3">
                {dashboard.queues.map((queue) => (
                  <QueueColumn key={queue.status} {...queue} />
                ))}
              </div>

              <RecentOrdersTable className="flex-1" orders={dashboard.recent_orders} />
            </div>

            <div className="space-y-4">
              <Card className="overflow-hidden border-primary/20 bg-primary text-primary-foreground">
                <CardContent className="p-5">
                  <div className="flex items-start gap-3">
                    <div className="grid size-11 place-items-center rounded-md bg-white/15 text-white">
                      <QrCode aria-hidden="true" className="size-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white/75">Scan pengambilan</p>
                      <p className="mt-1 text-2xl font-semibold">{dashboard.pickup_summary.ready_count} order siap</p>
                    </div>
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-md bg-white/12 p-3">
                      <p className="text-white/70">Lunas</p>
                      <p className="mt-1 text-xl font-semibold">{dashboard.pickup_summary.paid_ready_count}</p>
                    </div>
                    <div className="rounded-md bg-white/12 p-3">
                      <p className="text-white/70">Perlu bayar</p>
                      <p className="mt-1 text-xl font-semibold">{dashboard.pickup_summary.unpaid_ready_count}</p>
                    </div>
                  </div>
                  <Button asChild className="mt-4 w-full bg-white text-primary hover:bg-white/90">
                    <Link to="/scan">
                      <QrCode aria-hidden="true" className="size-4" />
                      Buka scan QR
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <ServiceBreakdown services={dashboard.service_breakdowns} />
              <ActivityTimeline items={dashboard.activities} />
            </div>
          </section>
        </>
      ) : null}
    </>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Card key={index}>
            <CardContent className="p-5">
              <div className="h-4 w-28 rounded bg-muted" />
              <div className="mt-4 h-8 w-24 rounded bg-muted" />
              <div className="mt-3 h-3 w-36 rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.8fr]">
        <Card>
          <CardContent className="p-5">
            <div className="h-64 rounded bg-muted" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <div className="h-64 rounded bg-muted" />
          </CardContent>
        </Card>
      </section>
    </>
  )
}

function DateInput({
  label,
  onChange,
  value,
}: {
  label: string
  onChange: (value: string) => void
  value: string
}) {
  return (
    <label className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input
        aria-label={label}
        className="h-auto w-[8.75rem] border-0 bg-transparent p-0 focus-visible:ring-0"
        onChange={(event) => onChange(event.target.value)}
        type="date"
        value={value}
      />
    </label>
  )
}

function formatDateRange(startDate: string, endDate: string) {
  if (startDate === endDate) {
    return formatBusinessDate(startDate)
  }

  return `${formatBusinessDate(startDate)} - ${formatBusinessDate(endDate)}`
}

function formatBusinessDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
  }).format(parseInputDate(value))
}

function formatCompactRupiah(value: number) {
  if (value >= 1_000_000) {
    return `Rp${(value / 1_000_000).toLocaleString('id-ID', {
      maximumFractionDigits: 2,
      minimumFractionDigits: 0,
    })} jt`
  }

  if (value >= 1_000) {
    return `Rp${(value / 1_000).toLocaleString('id-ID', {
      maximumFractionDigits: 0,
    })} rb`
  }

  return formatRupiah(value)
}

function formatSignedNumber(value: number) {
  if (value > 0) {
    return `+${value}`
  }

  return String(value)
}

function formatWeight(value: string) {
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(Number(value))
}

function getTodayInputValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${year}-${month}-${day}`
}

function parseInputDate(value: string) {
  return new Date(`${value}T00:00:00`)
}
