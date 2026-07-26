import { ArrowLeft, Database, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'

import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { type AuditLogRecord, fetchAuditLog } from '@/features/audit/auditApi'

export function AuditDetailPage() {
  const params = useParams()
  const [audit, setAudit] = useState<AuditLogRecord | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(params.auditId))
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true
    if (!params.auditId) {
      setIsLoading(false)
      setErrorMessage('ID audit log tidak valid.')
      return
    }

    setIsLoading(true)
    fetchAuditLog(params.auditId)
      .then((item) => {
        if (isMounted) {
          setAudit(item)
          setErrorMessage('')
        }
      })
      .catch((error) => {
        if (isMounted) {
          setAudit(null)
          setErrorMessage(error instanceof Error ? error.message : 'Audit log tidak ditemukan.')
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
  }, [params.auditId])

  if (isLoading) {
    return <PageHeader description="Memuat rincian aktivitas..." eyebrow="Detail audit" title="Memuat..." />
  }

  if (!audit) {
    return (
      <PageHeader
        actions={
          <Button asChild variant="outline">
            <Link to="/settings/audit">
              <ArrowLeft className="size-4" />
              Kembali ke Audit Logs
            </Link>
          </Button>
        }
        description={errorMessage || 'Audit log tidak ditemukan di database.'}
        eyebrow="Detail audit"
        title="Tidak Ditemukan"
      />
    )
  }

  const payloadObj = parseJsonPayload(audit.payload)

  return (
    <>
      <PageHeader
        actions={
          <Button asChild variant="outline">
            <Link to="/settings/audit">
              <ArrowLeft className="size-4" />
              Kembali ke Audit Logs
            </Link>
          </Button>
        }
        description={`${audit.user_name} (${audit.user_role}) · ${audit.action} · ${formatDate(audit.created_at)}`}
        eyebrow="Detail audit"
        title={`Audit Log #${audit.id}`}
      />

      <section className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>Peristiwa & Jejak Aktivitas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Info label="ID Audit" value={`#${audit.id}`} />
            <Info label="Aksi" value={audit.action} />
            <Info label="Entitas Target" value={`${audit.entity.toUpperCase()} ${audit.entity_id ? '#' + audit.entity_id : ''}`} />
            <Info label="Waktu Kejadian" value={formatDate(audit.created_at)} />
            <Info label="Pengguna (Aktor)" value={`${audit.user_name} (${audit.user_role})`} />
            <Info label="ID User Aktor" value={audit.user_id > 0 ? `#${audit.user_id}` : 'Sistem'} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Status Rekaman</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck aria-hidden="true" className="size-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Tercatat Permanen</p>
                <Badge variant="success">PostgreSQL Audit Log</Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Rincian Payload (Metadata)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.keys(payloadObj).length > 0 ? (
                Object.entries(payloadObj).map(([key, value]) => (
                  <div className="flex items-start gap-3" key={key}>
                    <Database aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase text-muted-foreground">{key}</p>
                      <p className="break-words font-mono text-sm font-semibold">{String(value)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">{audit.payload}</p>
              )}
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
      <p className="mt-1 text-sm font-semibold leading-6">{value}</p>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  }).format(new Date(value))
}

function parseJsonPayload(payload: string): Record<string, unknown> {
  try {
    return JSON.parse(payload) as Record<string, unknown>
  } catch {
    return {}
  }
}
