import { Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'

import { PageHeader } from '@/components/common/PageHeader'
import { PaginationBar } from '@/components/common/PaginationBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  type DetailReportRow,
  fetchReportDetail,
  getReportExportUrl,
} from '@/features/reports/reportsApi'
import { formatEnumLabel, formatRupiah } from '@/utils/format'

type ReportType = 'cash' | 'orders' | 'receivables' | 'services'

const titles: Record<ReportType, { description: string; title: string }> = {
  cash: {
    description: 'Drill-down penerimaan uang tunai berdasarkan transaksi pembayaran.',
    title: 'Detail penerimaan tunai',
  },
  orders: {
    description: 'Drill-down seluruh nilai pesanan kopi yang terdaftar di sistem.',
    title: 'Detail nilai transaksi',
  },
  receivables: {
    description: 'Drill-down pesanan aktif yang belum lunas pembayarannya.',
    title: 'Detail piutang (belum lunas)',
  },
  services: {
    description: 'Drill-down akumulasi transaksi dan volume berdasarkan jenis layanan.',
    title: 'Detail volume & pendapatan layanan',
  },
}

const PAGE_SIZE = 10

export function ReportDetailPage() {
  const params = useParams()
  const reportType: ReportType = isReportType(params.reportType) ? params.reportType : 'orders'

  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<DetailReportRow[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [metricText, setMetricText] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)

    fetchReportDetail({ page, pageSize: PAGE_SIZE, type: reportType })
      .then((res) => {
        if (isMounted) {
          setRows(res.data)
          setTotalItems(res.meta.total_items)
          setMetricText(res.meta.metric_text)
          setErrorMessage('')
        }
      })
      .catch(() => {
        if (isMounted) {
          setErrorMessage('Gagal memuat detail laporan.')
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
  }, [page, reportType])

  const meta = titles[reportType]
  const exportUrl = getReportExportUrl(reportType, {
    // We don't have the parent page filters here easily, but wait!
    // ReportDetailPage doesn't have local date filters right now.
  })

  return (
    <>
      <PageHeader
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/reports">Ringkasan</Link>
            </Button>
            <Button asChild>
              <a href={exportUrl} target="_blank" rel="noopener noreferrer">
                <Download aria-hidden="true" className="size-4" />
                Ekspor CSV
              </a>
            </Button>
          </>
        }
        description={meta.description}
        eyebrow="Detail laporan"
        title={meta.title}
      />

      <section className="grid gap-4 xl:grid-cols-[18rem_1fr]">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Jumlah Record</p>
            <p className="mt-2 text-3xl font-semibold">{metricText || `${totalItems} Data`}</p>
            <p className="mt-2 text-xs text-muted-foreground">Data real dari database</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Rincian Data</CardTitle>
          </CardHeader>
          {errorMessage && (
            <div className="border-t border-border px-5 py-3 text-sm text-destructive">{errorMessage}</div>
          )}
          <CardContent className="p-0">
            <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-y border-border bg-muted/70 text-left text-xs font-semibold uppercase text-muted-foreground">
                  <th className="px-5 py-3">Kode / Item</th>
                  <th className="px-5 py-3">Nilai Utama</th>
                  <th className="px-5 py-3">Keterangan</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td className="px-5 py-8 text-muted-foreground" colSpan={4}>
                      Memuat detail laporan...
                    </td>
                  </tr>
                )}
                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td className="px-5 py-8 text-muted-foreground" colSpan={4}>
                      Belum ada data untuk laporan ini.
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  rows.map((row, idx) => (
                    <tr className="border-b border-border last:border-b-0" key={row.code + idx}>
                      <td className="px-5 py-4 font-medium">{row.code}</td>
                      <td className="px-5 py-4 font-semibold">
                        {reportType === 'services' ? row.primary_text : formatRupiah(row.primary_value)}
                      </td>
                      <td className="px-5 py-4 text-muted-foreground">
                        {reportType === 'services' ? row.secondary_text : row.primary_text}
                      </td>
                      <td className="px-5 py-4">
                        <Badge variant="secondary">{formatEnumLabel(row.status)}</Badge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            </div>

            <div className="grid gap-3 p-4 md:hidden">
              {isLoading && (
                <div className="p-4 text-center text-sm text-muted-foreground">Memuat detail laporan...</div>
              )}
              {!isLoading && rows.length === 0 && (
                <div className="p-4 text-center text-sm text-muted-foreground">Belum ada data untuk laporan ini.</div>
              )}
              {!isLoading && rows.map((row, idx) => (
                <div
                  className="flex flex-col gap-3 rounded-md border border-border bg-background p-4"
                  key={row.code + idx}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-primary">{row.code}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {reportType === 'services' ? row.secondary_text : row.primary_text}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-foreground">
                        {reportType === 'services' ? row.primary_text : formatRupiah(row.primary_value)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <Badge variant="secondary">{formatEnumLabel(row.status)}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
          <PaginationBar
            onPageChange={setPage}
            page={page}
            pageSize={PAGE_SIZE}
            totalItems={totalItems}
          />
        </Card>
      </section>
    </>
  )
}

function isReportType(value: string | undefined): value is ReportType {
  return value === 'cash' || value === 'orders' || value === 'receivables' || value === 'services'
}
