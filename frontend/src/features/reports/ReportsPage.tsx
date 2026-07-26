import { CalendarDays, Download, RotateCcw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  fetchReportOverview,
  getReportExportUrl,
  type OverviewReportData,
} from '@/features/reports/reportsApi'
import { formatRupiah, formatWeight, WeightText } from '@/utils/format'

export function ReportsPage() {
  const [period, setPeriod] = useState<'custom' | 'month' | 'today' | 'week'>('month')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [serviceCode, setServiceCode] = useState('ALL')
  const [orderStatus, setOrderStatus] = useState('ALL')
  const [paymentStatus, setPaymentStatus] = useState('ALL')

  const [report, setReport] = useState<OverviewReportData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)

    fetchReportOverview({
      endDate: period === 'custom' ? endDate : undefined,
      orderStatus,
      paymentStatus,
      period,
      serviceCode,
      startDate: period === 'custom' ? startDate : undefined,
    })
      .then((data) => {
        if (isMounted) {
          setReport(data)
          setErrorMessage('')
        }
      })
      .catch(() => {
        if (isMounted) {
          setErrorMessage('Gagal memuat data laporan dari database.')
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
  }, [endDate, orderStatus, paymentStatus, period, serviceCode, startDate])

  function handleResetFilters() {
    setPeriod('month')
    setStartDate('')
    setEndDate('')
    setServiceCode('ALL')
    setOrderStatus('ALL')
    setPaymentStatus('ALL')
  }

  const queryParams = {
    endDate: period === 'custom' ? endDate : undefined,
    orderStatus,
    paymentStatus,
    period,
    serviceCode,
    startDate: period === 'custom' ? startDate : undefined,
  }

  const reportCards = [
    {
      detail: `${report?.total_order_count ?? 0} order terdaftar`,
      exportType: 'orders',
      href: '/reports/orders',
      title: 'Nilai transaksi',
      value: report ? formatRupiah(report.total_order_amount) : 'Rp0',
    },
    {
      detail: `${report?.total_cash_count ?? 0} transaksi bayar`,
      exportType: 'cash',
      href: '/reports/cash',
      title: 'Penerimaan kas tunai',
      value: report ? formatRupiah(report.total_cash_received) : 'Rp0',
    },
    {
      detail: 'Sesuai filter periode',
      exportType: 'services',
      href: '/reports/services',
      title: 'Total volume (Kg)',
      value: <WeightText value={report?.total_weight_kg ?? '0'} />,
    },
    {
      detail: `${report?.total_receivable_count ?? 0} tagihan`,
      exportType: 'receivables',
      href: '/reports/receivables',
      title: 'Piutang pelanggan',
      value: report ? formatRupiah(report.total_receivable_amount) : 'Rp0',
    },
  ]

  const exportUrl = getReportExportUrl('orders', queryParams)

  return (
    <div className="space-y-4">
      <PageHeader
        actions={
          <Button asChild variant="outline">
            <a href={exportUrl} target="_blank" rel="noopener noreferrer">
              <Download aria-hidden="true" className="size-4" />
              Ekspor CSV
            </a>
          </Button>
        }
        description="Laporan analitik operasional real dengan filter kustom tanggal, jenis layanan, status produksi, dan pembayaran."
        eyebrow="Analitik"
        title="Laporan"
      />

      {/* Card Filter Horizontal (Full-Width di Atas Statistik) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle>Filter Laporan</CardTitle>
          <Button onClick={handleResetFilters} size="sm" variant="ghost">
            <RotateCcw className="size-3.5" />
            Reset Filter
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            {/* Periode Preset */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Periode</Label>
              <Select onValueChange={(val) => setPeriod(val as 'custom' | 'month' | 'today' | 'week')} value={period}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hari Ini</SelectItem>
                  <SelectItem value="week">7 Hari Terakhir</SelectItem>
                  <SelectItem value="month">Bulan Ini</SelectItem>
                  <SelectItem value="custom">Tanggal Kustom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter Jenis Layanan */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Layanan</Label>
              <Select onValueChange={setServiceCode} value={serviceCode}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Layanan</SelectItem>
                  <SelectItem value="G">Giling Saja (G)</SelectItem>
                  <SelectItem value="R">Roasting Saja (R)</SelectItem>
                  <SelectItem value="GR">Giling + Roasting (GR)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter Status Pesanan */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status Produksi</Label>
              <Select onValueChange={setOrderStatus} value={orderStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Status</SelectItem>
                  <SelectItem value="MENUNGGU">Menunggu</SelectItem>
                  <SelectItem value="DIPROSES">Diproses</SelectItem>
                  <SelectItem value="SIAP_DIAMBIL">Siap Diambil</SelectItem>
                  <SelectItem value="SELESAI">Selesai</SelectItem>
                  <SelectItem value="DIBATALKAN">Dibatalkan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Filter Status Pembayaran */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status Pembayaran</Label>
              <Select onValueChange={setPaymentStatus} value={paymentStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Pembayaran</SelectItem>
                  <SelectItem value="BELUM_BAYAR">Belum Bayar</SelectItem>
                  <SelectItem value="DP">DP</SelectItem>
                  <SelectItem value="LUNAS">Lunas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Input Tanggal Kustom (tampil inline saat Tanggal Kustom dipilih) */}
            {period === 'custom' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="start-date" className="text-xs text-muted-foreground">
                    Dari Tanggal
                  </Label>
                  <Input
                    className="h-9"
                    id="start-date"
                    onChange={(e) => setStartDate(e.target.value)}
                    type="date"
                    value={startDate}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="end-date" className="text-xs text-muted-foreground">
                    Sampai Tanggal
                  </Label>
                  <Input
                    className="h-9"
                    id="end-date"
                    onChange={(e) => setEndDate(e.target.value)}
                    type="date"
                    value={endDate}
                  />
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Kartu Statistik */}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {reportCards.map((item) => (
          <Card className="transition-colors hover:bg-accent flex flex-col justify-between" key={item.title}>
            <Link className="block text-foreground flex-1" to={item.href}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{item.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{item.value}</div>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </CardContent>
            </Link>
            <div className="px-6 pb-6 pt-0">
              <Button asChild variant="outline" size="sm" className="w-full mt-2">
                <a href={getReportExportUrl(item.exportType, queryParams)} target="_blank" rel="noopener noreferrer">
                  <Download className="mr-2 size-3.5" />
                  Ekspor CSV
                </a>
              </Button>
            </div>
          </Card>
        ))}
      </section>

      {/* Grafik Recharts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Grafik Nilai Transaksi Harian</CardTitle>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <CalendarDays className="size-4" />
            <span>
              {period === 'today'
                ? 'Trend 7 Hari'
                : period === 'week'
                  ? '7 Hari Terakhir'
                  : period === 'month'
                    ? 'Bulan Ini'
                    : 'Rentang Kustom'}
            </span>
          </div>
        </CardHeader>
        {errorMessage && (
          <div className="border-t border-border px-5 py-3 text-sm text-destructive">{errorMessage}</div>
        )}
        <CardContent className="pt-4">
          {isLoading && (
            <p className="py-16 text-center text-muted-foreground">Memuat grafik dari database...</p>
          )}
          {!isLoading && (!report?.chart_data || report.chart_data.length === 0) && (
            <p className="py-16 text-center text-muted-foreground">Belum ada data transaksi untuk filter ini.</p>
          )}
          {!isLoading && report?.chart_data && report.chart_data.length > 0 && (
            <div className="h-80 w-full">
              <ResponsiveContainer height="100%" width="100%">
                <AreaChart data={report.chart_data} margin={{ bottom: 0, left: 10, right: 10, top: 10 }}>
                  <defs>
                    <linearGradient id="chartGradient" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="5%" stopColor="#16a34a" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#16a34a" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                  <XAxis
                    axisLine={false}
                    dataKey="label"
                    minTickGap={20}
                    tick={{ fill: 'currentColor', fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    axisLine={false}
                    tick={{ fill: 'currentColor', fontSize: 12 }}
                    tickFormatter={(val) => formatRupiahShort(Number(val))}
                    tickLine={false}
                  />
                  <RechartsTooltip content={<CustomChartTooltip />} />
                  <Area
                    dataKey="total_amount"
                    fill="url(#chartGradient)"
                    name="Nilai Transaksi"
                    stroke="#16a34a"
                    strokeWidth={2.5}
                    type="monotone"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CustomChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { label: string; order_count: number; total_amount: number; weight_kg: string } }> }) {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="rounded-lg border border-border bg-background p-3 shadow-lg text-xs space-y-1">
        <p className="font-semibold text-foreground">Tanggal: {data.label}</p>
        <p className="text-primary font-semibold">Nilai Transaksi: {formatRupiah(data.total_amount)}</p>
        <p className="text-muted-foreground">Jumlah Order: {data.order_count} transaksi</p>
        <p className="text-muted-foreground">Volume Kopi: {formatWeight(data.weight_kg)}</p>
      </div>
    )
  }

  return null
}

function formatRupiahShort(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}jt`
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k`
  }
  return String(value)
}
