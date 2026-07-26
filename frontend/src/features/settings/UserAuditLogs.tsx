import { FilterX, ListFilter } from 'lucide-react'
import { useEffect, useState } from 'react'

import { PaginationBar } from '@/components/common/PaginationBar'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { type AuditLogRecord, fetchAuditLogs } from '@/features/audit/auditApi'

const PAGE_SIZE = 5

export function UserAuditLogs({ username }: { username: string }) {
  const [page, setPage] = useState(1)
  const [logs, setLogs] = useState<AuditLogRecord[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)

    fetchAuditLogs({
      entity: 'users',
      entity_id: username,
      page,
      pageSize: PAGE_SIZE,
    })
      .then((result) => {
        if (isMounted) {
          setLogs(result.data)
          setTotalItems(result.meta.total_items)
          setErrorMessage('')
        }
      })
      .catch((error) => {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : 'Daftar audit log gagal dimuat.')
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
  }, [username, page])

  if (isLoading) {
    return (
      <Card className="mt-6 border-none bg-card shadow-sm ring-1 ring-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListFilter className="size-5 text-primary" />
            Riwayat Aktivitas
          </CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Memuat data riwayat aktivitas...
        </CardContent>
      </Card>
    )
  }

  if (errorMessage) {
    return (
      <Card className="mt-6 border-none bg-card shadow-sm ring-1 ring-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ListFilter className="size-5 text-primary" />
            Riwayat Aktivitas
          </CardTitle>
        </CardHeader>
        <CardContent className="py-12 text-center text-sm text-destructive">
          {errorMessage}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="mt-6 border-none bg-card shadow-sm ring-1 ring-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <ListFilter className="size-5 text-primary" />
          Riwayat Aktivitas
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {logs.length === 0 ? (
          <div className="py-12 text-center">
            <FilterX className="mx-auto size-8 text-muted-foreground/50" />
            <p className="mt-2 text-sm font-medium text-muted-foreground">Belum ada aktivitas tercatat.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/30 text-xs font-semibold uppercase text-muted-foreground">
                <tr>
                  <th className="px-6 py-3">Waktu</th>
                  <th className="px-6 py-3">Aktor</th>
                  <th className="px-6 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {logs.map((item) => {
                  let ip = ''
                  let userAgent = ''
                  if (item.action === 'LOGIN' || item.action === 'LOGOUT') {
                    try {
                      const payloadObj = JSON.parse(item.payload) as { ip_address?: string; user_agent?: string }
                      ip = payloadObj.ip_address || ''
                      userAgent = payloadObj.user_agent || ''
                    } catch {}
                  }

                  return (
                  <tr className="transition-colors hover:bg-muted/10" key={item.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-xs text-muted-foreground">
                      {formatDateTime(item.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{item.user_name}</span>
                        <Badge className="text-[10px]" variant={item.user_role === 'OWNER' ? 'default' : 'secondary'}>
                          {item.user_role}
                        </Badge>
                      </div>
                      {(ip || userAgent) && (
                        <div className="mt-1.5 flex flex-col gap-0.5">
                          {ip && <span className="text-[10px] text-muted-foreground font-mono">IP: {ip}</span>}
                          {userAgent && <span className="text-[10px] text-muted-foreground max-w-xs truncate" title={userAgent}>{userAgent}</span>}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <ActionBadge action={item.action} />
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
      {totalItems > PAGE_SIZE && (
        <PaginationBar onPageChange={setPage} page={page} pageSize={PAGE_SIZE} totalItems={totalItems} />
      )}
    </Card>
  )
}

function ActionBadge({ action }: { action: string }) {
  let variant: 'default' | 'destructive' | 'outline' | 'secondary' | 'success' = 'outline'

  if (action.includes('CREATE') || action.includes('SETTLE') || action === 'LOGIN') {
    variant = 'success'
  } else if (action.includes('VOID') || action.includes('DELETE') || action.includes('CANCEL') || action === 'LOGOUT') {
    variant = 'destructive'
  } else if (action.includes('UPDATE') || action === 'RESET_PASSWORD') {
    variant = 'secondary'
  }

  return <Badge variant={variant}>{action}</Badge>
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}
