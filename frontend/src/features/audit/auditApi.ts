export interface AuditLogRecord {
  action: string
  created_at: string
  entity: string
  entity_id: number | string
  id: number
  payload: string
  user_id: number
  user_name: string
  user_role: string
}

export interface AuditLogsQuery {
  action?: string
  entity?: string
  entity_id?: string
  page: number
  pageSize: number
  search?: string
}

export interface AuditLogsResponse {
  data: AuditLogRecord[]
  meta: {
    page: number
    page_size: number
    total_items: number
  }
}

export async function fetchAuditLogs(query: AuditLogsQuery) {
  const params = new URLSearchParams({
    page: String(query.page),
    page_size: String(query.pageSize),
  })
  if (query.action && query.action !== 'ALL') params.set('action', query.action)
  if (query.entity && query.entity !== 'ALL') params.set('entity', query.entity)
  if (query.entity_id) params.set('entity_id', query.entity_id)
  if (query.search) params.set('search', query.search)

  const response = await fetch(`/api/v1/audit-logs?${params.toString()}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Gagal memuat log aktivitas audit dari database.')
  }

  return (await response.json()) as AuditLogsResponse
}

export async function fetchAuditLog(id: string | number) {
  const response = await fetch(`/api/v1/audit-logs/${id}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Audit log tidak ditemukan.')
  }

  const payload = (await response.json()) as { data: AuditLogRecord }
  return payload.data
}
