import type { OrderStatus, PaymentStatus } from '@/features/orders/ordersApi'

export interface DashboardOverview {
  activities: DashboardActivity[]
  business_date: string
  date_range: {
    end_date: string
    start_date: string
  }
  generated_at: string
  pickup_summary: {
    paid_ready_count: number
    ready_count: number
    unpaid_ready_count: number
  }
  queues: DashboardQueue[]
  recent_orders: DashboardRecentOrder[]
  service_breakdowns: DashboardServiceBreakdown[]
  summary: {
    cash_amount_today: number
    cash_payments_today: number
    coffee_weight_today_kg: string
    outstanding_amount_active: number
    outstanding_orders_active: number
    transactions_today: number
    transactions_previous: number
    expenses_today: number
  }
}

export interface DashboardQueue {
  count: number
  orders: Array<{
    created_at: string
    customer_name: string
    order_code: string
  }>
  status: Extract<OrderStatus, 'DIPROSES' | 'MENUNGGU' | 'SIAP_DIAMBIL'>
}

export interface DashboardRecentOrder {
  created_at: string
  customer_name: string
  order_code: string
  order_status: OrderStatus
  payment_status: PaymentStatus
  service_code: string
  service_name: string
  total_amount: number
  weight_kg: string
}

export interface DashboardServiceBreakdown {
  amount: number
  order_count: number
  service_code: string
  service_name: string
  weight_kg: string
}

export interface DashboardActivity {
  changed_at: string
  customer_name: string
  notes: string | null
  order_code: string
  status: OrderStatus
}

interface DashboardResponse {
  data: DashboardOverview
}

export async function fetchDashboardOverview(query?: { endDate?: string; startDate?: string }) {
  const params = new URLSearchParams()
  if (query?.startDate) {
    params.set('start_date', query.startDate)
  }
  if (query?.endDate) {
    params.set('end_date', query.endDate)
  }

  const queryString = params.toString()
  const response = await fetch(`/api/v1/dashboard${queryString ? `?${queryString}` : ''}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('DASHBOARD_FAILED')
  }

  const result = (await response.json()) as DashboardResponse
  return result.data
}
