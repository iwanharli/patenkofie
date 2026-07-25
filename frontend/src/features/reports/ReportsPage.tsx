import { CalendarDays, Download } from 'lucide-react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const reportCards = [
  { title: 'Nilai transaksi', value: 'Rp2.166.000', detail: '18 order hari ini', href: '/reports/orders' },
  { title: 'Penerimaan tunai', value: 'Rp1.820.000', detail: 'Berdasarkan paid_at', href: '/reports/cash' },
  { title: 'Volume layanan', value: '182,5 kg', detail: 'G, R, dan GR', href: '/reports/services' },
  { title: 'Belum lunas', value: 'Rp740.000', detail: 'Piutang order aktif', href: '/reports/receivables' },
] as const

export function ReportsPage() {
  return (
    <>
      <PageHeader
        actions={
          <>
            <Button variant="outline">
              <CalendarDays aria-hidden="true" className="size-4" />
              Rentang tanggal
            </Button>
            <Button>
              <Download aria-hidden="true" className="size-4" />
              Ekspor
            </Button>
          </>
        }
        description="Mock laporan operasional untuk transaksi, kas tunai, volume layanan, dan produktivitas."
        eyebrow="Analitik"
        title="Laporan"
      />

      <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Filter</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Select defaultValue="today">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Hari ini</SelectItem>
                <SelectItem value="week">Minggu ini</SelectItem>
                <SelectItem value="month">Bulan ini</SelectItem>
              </SelectContent>
            </Select>
            <Select defaultValue="all">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua layanan</SelectItem>
                <SelectItem value="G">Giling</SelectItem>
                <SelectItem value="R">Roasting</SelectItem>
                <SelectItem value="GR">Giling + roasting</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {reportCards.map((report) => (
            <Card className="transition-colors hover:bg-accent" key={report.title}>
              <Link className="block text-foreground" to={report.href}>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground">{report.title}</p>
                <p className="mt-2 text-2xl font-semibold">{report.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{report.detail}</p>
              </CardContent>
              </Link>
            </Card>
          ))}
        </section>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Grafik mock</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-72 items-end gap-3 rounded-lg bg-muted p-4">
            {[42, 70, 55, 90, 62, 78, 48].map((height, index) => (
              <div className="flex flex-1 flex-col items-center gap-2" key={height + index}>
                <div className="w-full rounded-t-md bg-primary" style={{ height: `${height}%` }} />
                <span className="text-xs text-muted-foreground">{index + 20}/7</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </>
  )
}
