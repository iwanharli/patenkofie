import { CalendarDays, Download } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'

import { PageHeader } from '@/components/common/PageHeader'
import { PaginationBar } from '@/components/common/PaginationBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { reportDetails } from '@/features/shared/mockData'
import { formatEnumLabel } from '@/utils/format'
import { getPaginatedItems } from '@/utils/pagination'

type ReportType = keyof typeof reportDetails
type ReportRow = {
  label: string
  primary: string
  secondary: string
  status: string
}
const PAGE_SIZE = 10

export function ReportDetailPage() {
  const [page, setPage] = useState(1)
  const params = useParams()
  const reportType = isReportType(params.reportType) ? params.reportType : 'orders'
  const report = reportDetails[reportType]
  const reportRows: readonly ReportRow[] = report.rows
  const paginatedRows = getPaginatedItems(reportRows, page, PAGE_SIZE)

  return (
    <>
      <PageHeader
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/reports">Ringkasan</Link>
            </Button>
            <Button variant="outline">
              <CalendarDays aria-hidden="true" className="size-4" />
              Hari ini
            </Button>
            <Button>
              <Download aria-hidden="true" className="size-4" />
              Ekspor
            </Button>
          </>
        }
        description={report.description}
        eyebrow="Detail laporan"
        title={report.title}
      />

      <section className="grid gap-4 xl:grid-cols-[18rem_1fr]">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="mt-2 text-3xl font-semibold">{report.metric}</p>
            <p className="mt-2 text-xs text-muted-foreground">Mock data 26 Juli 2026</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Drill-down</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[680px] border-collapse text-sm">
              <thead>
                <tr className="border-y border-border bg-muted/70 text-left text-xs font-semibold uppercase text-muted-foreground">
                  <th className="px-5 py-3">Item</th>
                  <th className="px-5 py-3">Nilai utama</th>
                  <th className="px-5 py-3">Keterangan</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((row) => (
                  <tr className="border-b border-border last:border-b-0" key={row.label}>
                    <td className="px-5 py-4 font-medium">{row.label}</td>
                    <td className="px-5 py-4 font-semibold">{row.primary}</td>
                    <td className="px-5 py-4 text-muted-foreground">{row.secondary}</td>
                    <td className="px-5 py-4">
                      <Badge variant="secondary">{formatEnumLabel(row.status)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
          <PaginationBar
            onPageChange={setPage}
            page={page}
            pageSize={PAGE_SIZE}
            totalItems={report.rows.length}
          />
        </Card>
      </section>
    </>
  )
}

function isReportType(value: string | undefined): value is ReportType {
  return value === 'cash' || value === 'orders' || value === 'receivables' || value === 'services'
}
