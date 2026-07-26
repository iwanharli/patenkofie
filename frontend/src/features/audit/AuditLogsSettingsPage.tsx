import { ExternalLink, Eye, FilterX, RotateCcw, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/common/PageHeader'
import { PaginationBar } from '@/components/common/PaginationBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { type AuditLogRecord, fetchAuditLogs } from '@/features/audit/auditApi'
import { SettingsTabs } from '@/features/settings/SettingsTabs'

const PAGE_SIZE = 15

export function AuditLogsSettingsPage() {
  const [page, setPage] = useState(1)
  const [logs, setLogs] = useState<AuditLogRecord[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [actionFilter, setActionFilter] = useState('ALL')
  const [entityFilter, setEntityFilter] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

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

    fetchAuditLogs({
      action: actionFilter,
      entity: entityFilter,
      page,
      pageSize: PAGE_SIZE,
      search: debouncedSearchTerm,
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
  }, [actionFilter, entityFilter, page, debouncedSearchTerm])

  function handleResetFilters() {
    setActionFilter('ALL')
    setEntityFilter('ALL')
    setSearchTerm('')
    setDebouncedSearchTerm('')
    setPage(1)
  }

  return (
    <>
      <PageHeader
        actions={<SettingsTabs />}
        description="Jejak kronologis aktivitas, pembuatan data, dan pengubahan sistem oleh pengguna."
        eyebrow="Pengaturan"
        title="Audit Logs"
      />

      <section className="space-y-4">
        {/* Filter Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Filter Jejak Aktivitas</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative lg:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Cari nama pengguna, aksi, entitas, atau payload..."
                value={searchTerm}
              />
            </div>

            <div>
              <Select
                onValueChange={(val) => {
                  setActionFilter(val)
                  setPage(1)
                }}
                value={actionFilter}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Aksi" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Aksi</SelectItem>
                  <SelectItem value="CREATE_ORDER">Buat Order</SelectItem>
                  <SelectItem value="UPDATE_ORDER">Edit Order</SelectItem>
                  <SelectItem value="UPDATE_STATUS">Ubah Status Order</SelectItem>
                  <SelectItem value="SETTLE_PAYMENT">Pelunasan Pembayaran</SelectItem>
                  <SelectItem value="UPDATE_PAYMENT">Koreksi Pembayaran</SelectItem>
                  <SelectItem value="VOID_PAYMENT">Pembatalan Pembayaran</SelectItem>
                  <SelectItem value="LOGIN">User Login</SelectItem>
                  <SelectItem value="LOGOUT">User Logout</SelectItem>
                  <SelectItem value="CREATE_USER">Tambah User</SelectItem>
                  <SelectItem value="UPDATE_USER">Ubah User</SelectItem>
                  <SelectItem value="RESET_PASSWORD">Reset Password</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Select
                onValueChange={(val) => {
                  setEntityFilter(val)
                  setPage(1)
                }}
                value={entityFilter}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pilih Entitas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Semua Entitas</SelectItem>
                  <SelectItem value="orders">Orders</SelectItem>
                  <SelectItem value="payments">Payments</SelectItem>
                  <SelectItem value="users">Users</SelectItem>
                  <SelectItem value="customers">Customers</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={handleResetFilters} size="icon" title="Reset Filter" variant="outline">
                <RotateCcw className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Audit Logs Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Riwayat Audit Log</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">
                Menampilkan {logs.length} dari total {totalItems} rekaman audit.
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading && (
              <p className="py-16 text-center text-sm text-muted-foreground">Memuat data audit log...</p>
            )}

            {errorMessage && (
              <p className="py-16 text-center text-sm text-destructive">{errorMessage}</p>
            )}

            {!isLoading && !errorMessage && logs.length === 0 && (
              <div className="py-16 text-center">
                <FilterX className="mx-auto size-10 text-muted-foreground" />
                <p className="mt-2 text-sm font-medium">Tidak ada rekaman audit log ditemukan.</p>
                <p className="mt-1 text-xs text-muted-foreground">Coba ubah kata kunci atau filter yang Anda pilih.</p>
              </div>
            )}

            {!isLoading && !errorMessage && logs.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-muted/50 text-xs font-semibold uppercase text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3">Waktu</th>
                      <th className="px-5 py-3">Pengguna</th>
                      <th className="px-5 py-3">Aksi</th>
                      <th className="px-5 py-3">Entitas Target</th>
                      <th className="px-5 py-3">Rincian Payload</th>
                      <th className="px-5 py-3 text-right">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {logs.map((item) => (
                      <tr className="hover:bg-muted/30" key={item.id}>
                        <td className="whitespace-nowrap px-5 py-3 text-xs text-muted-foreground">
                          {formatDateTime(item.created_at)}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{item.user_name}</span>
                            <Badge variant={item.user_role === 'OWNER' ? 'default' : 'secondary'}>
                              {item.user_role}
                            </Badge>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3">
                          <ActionBadge action={item.action} />
                        </td>
                        <td className="whitespace-nowrap px-5 py-3">
                          <EntityLink item={item} />
                        </td>
                        <td className="px-5 py-3 text-xs font-mono max-w-md truncate">
                          {formatPayloadPreview(item.payload)}
                        </td>
                        <td className="px-5 py-3 text-right whitespace-nowrap">
                          <Button asChild size="sm" variant="ghost">
                            <Link to={`/audit/${item.id}`}>
                              <Eye className="size-4" />
                              Detail Audit
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
          <PaginationBar onPageChange={setPage} page={page} pageSize={PAGE_SIZE} totalItems={totalItems} />
        </Card>
      </section>
    </>
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

function formatPayloadPreview(payload: string) {
  try {
    const obj = JSON.parse(payload) as Record<string, unknown>
    return Object.entries(obj)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')
  } catch {
    return payload
  }
}

function EntityLink({ item }: { item: AuditLogRecord }) {
  const url = getEntityTargetUrl(item)
  const label = getEntityLabel(item)
  const isDeleted = item.action.includes('DELETE') || item.action.includes('VOID')

  if (!url) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <span className="font-mono text-xs font-semibold uppercase text-foreground">
          {label}
        </span>
        {isDeleted && (
          <span className="text-[10px] text-destructive font-sans font-medium">(Dihapus)</span>
        )}
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <Link
        className="inline-flex items-center gap-1 rounded bg-secondary/80 px-2 py-0.5 font-mono text-xs font-semibold uppercase text-secondary-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
        title={`Buka detail ${label}`}
        to={url}
      >
        <span>{label}</span>
        <ExternalLink aria-hidden="true" className="size-3 shrink-0" />
      </Link>
      {isDeleted && (
        <span className="text-[10px] text-destructive font-sans font-medium">(Dihapus)</span>
      )}
    </div>
  )
}

function getEntityLabel(item: AuditLogRecord) {
  const entity = item.entity.toLowerCase()
  const payload = parseJsonPayload(item.payload)
  const entityIdStr = String(item.entity_id ?? '')

  if (entity === 'payments') {
    if (payload.payment_code && typeof payload.payment_code === 'string') {
      return `PAYMENTS #${payload.payment_code}`
    }
    if (entityIdStr.startsWith('PAY-')) {
      return `PAYMENTS #${entityIdStr}`
    }
    if (entityIdStr && !isNaN(Number(entityIdStr)) && Number(entityIdStr) > 0) {
      return `PAYMENTS #PAY-${entityIdStr.padStart(6, '0')}`
    }
    if (payload.order_code && typeof payload.order_code === 'string') {
      return `PAYMENTS (${payload.order_code})`
    }
    return 'PAYMENTS'
  }

  if (entity === 'orders') {
    if (payload.order_code && typeof payload.order_code === 'string') {
      return `ORDERS ${payload.order_code}`
    }
    if (entityIdStr && entityIdStr.startsWith('Paten-')) {
      return `ORDERS ${entityIdStr}`
    }
    if (entityIdStr && entityIdStr !== '0') {
      return `ORDERS #${entityIdStr}`
    }
    return 'ORDERS'
  }

  if (entity === 'pickups') {
    if (payload.order_code && typeof payload.order_code === 'string') {
      return `PICKUPS (${payload.order_code})`
    }
    if (entityIdStr && entityIdStr.startsWith('Paten-')) {
      return `PICKUPS (${entityIdStr})`
    }
    if (entityIdStr && entityIdStr !== '0') {
      return `PICKUPS #${entityIdStr}`
    }
    return 'PICKUPS'
  }

  if (entity === 'customers') {
    if (payload.customer_name && typeof payload.customer_name === 'string') {
      return `CUSTOMERS ${payload.customer_name}`
    }
    if (entityIdStr && entityIdStr !== '0') {
      return `CUSTOMERS #${entityIdStr}`
    }
    return 'CUSTOMERS'
  }

  if (entity === 'users') {
    if (payload.username && typeof payload.username === 'string') {
      return `USERS @${payload.username}`
    }
    if (entityIdStr && entityIdStr !== '0') {
      return `USERS @${entityIdStr}`
    }
    return 'USERS'
  }

  if (entity === 'services') {
    return 'SERVICES'
  }

  if (entity === 'app_settings') {
    return 'PROFIL TOKO'
  }

  return item.entity.toUpperCase()
}

function getEntityTargetUrl(item: AuditLogRecord): string | null {
  const entity = item.entity.toLowerCase()
  const payload = parseJsonPayload(item.payload)
  const entityIdStr = String(item.entity_id ?? '')

  if (entity === 'orders' || entity === 'pickups' || entity === 'order_status_logs') {
    if (payload.order_code && typeof payload.order_code === 'string') {
      return `/orders/${payload.order_code}`
    }
    if (entityIdStr.startsWith('Paten-')) {
      return `/orders/${entityIdStr}`
    }
    return '/orders'
  }

  if (entity === 'payments') {
    if (payload.payment_code && typeof payload.payment_code === 'string') {
      return `/payments/${payload.payment_code}`
    }
    if (entityIdStr.startsWith('PAY-')) {
      return `/payments/${entityIdStr}`
    }
    if (entityIdStr && !isNaN(Number(entityIdStr)) && Number(entityIdStr) > 0) {
      const codeStr = entityIdStr.padStart(6, '0')
      return `/payments/PAY-${codeStr}`
    }
    if (payload.order_code && typeof payload.order_code === 'string') {
      return `/orders/${payload.order_code}`
    }
    return '/payments'
  }

  if (entity === 'customers') {
    if (entityIdStr && entityIdStr !== '0') {
      return `/customers/${entityIdStr}`
    }
    return '/customers'
  }

  if (entity === 'users') {
    if (payload.username && typeof payload.username === 'string') {
      return `/settings/users/${payload.username}`
    }
    if (entityIdStr && entityIdStr !== '0') {
      return `/settings/users/${entityIdStr}`
    }
    return '/settings/users'
  }

  if (entity === 'services') {
    return '/settings/services'
  }

  if (entity === 'app_settings') {
    return '/settings/profile'
  }

  return null
}

function parseJsonPayload(payload: string): Record<string, unknown> {
  try {
    return JSON.parse(payload) as Record<string, unknown>
  } catch {
    return {}
  }
}
