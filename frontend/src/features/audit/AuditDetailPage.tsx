import { Database, ShieldCheck } from 'lucide-react'
import { useParams } from 'react-router'

import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { auditLogs } from '@/features/shared/mockData'
import { formatEnumLabel } from '@/utils/format'

export function AuditDetailPage() {
  const params = useParams()
  const audit = auditLogs.find((item) => item.id === params.auditId) ?? auditLogs[0]

  return (
    <>
      <PageHeader
        description={`${audit.actor} · ${audit.entity} · ${audit.time}`}
        eyebrow="Detail audit"
        title={audit.id}
      />

      <section className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>Peristiwa</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Info label="Aksi" value={audit.action} />
            <Info label="Entitas" value={audit.entity} />
            <Info label="Aktor" value={audit.actor} />
            <Info label="Waktu" value={audit.time} />
            <div className="sm:col-span-2">
              <Info label="Ringkasan" value={audit.summary} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Status audit</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground">
                <ShieldCheck aria-hidden="true" className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Tercatat</p>
                <Badge variant="success">Immutable mock</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(audit.metadata).map(([key, value]) => (
                <div className="flex items-start gap-3" key={key}>
                  <Database aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">{key}</p>
                    <p className="text-sm font-semibold">{formatEnumLabel(value)}</p>
                  </div>
                </div>
              ))}
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
