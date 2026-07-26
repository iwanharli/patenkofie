export interface ChartPoint {
  date: string
  label: string
  order_count: number
  total_amount: number
  weight_kg: string
}

export interface OverviewReportData {
  chart_data: ChartPoint[]
  total_cash_count: number
  total_cash_received: number
  total_order_amount: number
  total_order_count: number
  total_receivable_amount: number
  total_receivable_count: number
  total_weight_kg: string
}

export interface DetailReportRow {
  code: string
  date: string
  id: string
  primary_text: string
  primary_value: number
  secondary_text: string
  status: string
}

export interface DetailReportResponse {
  data: DetailReportRow[]
  meta: {
    metric_text: string
    page: number
    page_size: number
    total_items: number
  }
}

export interface ReportQuery {
  endDate?: string
  orderStatus?: string
  paymentStatus?: string
  period?: 'custom' | 'month' | 'today' | 'week'
  serviceCode?: string
  startDate?: string
}

export interface ReportDetailQuery extends ReportQuery {
  page?: number
  pageSize?: number
  type: 'cash' | 'orders' | 'receivables' | 'services'
}

export async function fetchReportOverview(query: ReportQuery) {
  const params = new URLSearchParams()
  if (query.period && query.period !== 'custom') params.set('period', query.period)
  if (query.startDate) params.set('start_date', query.startDate)
  if (query.endDate) params.set('end_date', query.endDate)
  if (query.serviceCode && query.serviceCode !== 'ALL') params.set('service_code', query.serviceCode)
  if (query.orderStatus && query.orderStatus !== 'ALL') params.set('order_status', query.orderStatus)
  if (query.paymentStatus && query.paymentStatus !== 'ALL') params.set('payment_status', query.paymentStatus)

  const response = await fetch(`/api/v1/reports/overview?${params.toString()}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('REPORT_OVERVIEW_FAILED')
  }

  const result = (await response.json()) as { data: OverviewReportData }
  return result.data
}

export async function fetchReportDetail(query: ReportDetailQuery) {
  const params = new URLSearchParams({
    page: String(query.page ?? 1),
    page_size: String(query.pageSize ?? 10),
    type: query.type,
  })
  if (query.startDate) params.set('start_date', query.startDate)
  if (query.endDate) params.set('end_date', query.endDate)
  if (query.serviceCode && query.serviceCode !== 'ALL') params.set('service_code', query.serviceCode)
  if (query.orderStatus && query.orderStatus !== 'ALL') params.set('order_status', query.orderStatus)
  if (query.paymentStatus && query.paymentStatus !== 'ALL') params.set('payment_status', query.paymentStatus)

  const response = await fetch(`/api/v1/reports/detail?${params.toString()}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('REPORT_DETAIL_FAILED')
  }

  return (await response.json()) as DetailReportResponse
}

export function getReportExportUrl(type: string, query: ReportQuery) {
  const params = new URLSearchParams({ type })
  if (query.period && query.period !== 'custom') params.set('period', query.period)
  if (query.startDate) params.set('start_date', query.startDate)
  if (query.endDate) params.set('end_date', query.endDate)
  if (query.serviceCode && query.serviceCode !== 'ALL') params.set('service_code', query.serviceCode)
  if (query.orderStatus && query.orderStatus !== 'ALL') params.set('order_status', query.orderStatus)
  if (query.paymentStatus && query.paymentStatus !== 'ALL') params.set('payment_status', query.paymentStatus)

  return `/api/v1/reports/export?${params.toString()}`
}
