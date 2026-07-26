export interface CreateOrderPayload {
  customer_name: string
  customer_phone: string
  grind_level: string
  notes: string
  paid_amount: number
  payment_type: 'DOWN_PAYMENT' | 'FULL_PAYMENT' | 'PAY_LATER'
  roast_level: 'CUSTOM' | 'DARK' | 'LIGHT' | 'MEDIUM' | 'NONE'
  service_code: string
  weight_unit: 'GRAM' | 'KG'
  weight_value: number
}

export type OrderStatus = 'DIBATALKAN' | 'DIPROSES' | 'MENUNGGU' | 'SELESAI' | 'SIAP_DIAMBIL'
export type PaymentStatus = 'BELUM_BAYAR' | 'DP' | 'LUNAS'

export interface UpdateOrderPayload {
  notes: string
  service_code: string
  weight_grams: number
}

export interface OrderStatusLogItem {
  changed_at: string
  changed_by_name: string
  new_status: OrderStatus
  notes: string
  previous_status: OrderStatus
}

export interface OrderRecord {
  created_at: string
  created_by_name?: string
  customer_id: number
  customer_name: string
  customer_phone: string | null
  grind_level: string | null
  id: number
  notes: string | null
  order_code: string
  order_status: OrderStatus
  paid_amount: number
  payment_status: PaymentStatus
  picked_up_by_name?: string | null
  price_per_kg: number
  remaining: number
  roast_level: string | null
  service_code: string
  service_name: string
  status_logs?: OrderStatusLogItem[]
  total_amount: number
  updated_at: string
  weight_kg: string
}

interface OrderResponse {
  data: OrderRecord
}

interface OrdersResponse {
  data: OrderRecord[]
  meta: {
    page: number
    page_size: number
    total_items: number
  }
}

interface BulkUpdateStatusResponse {
  data: {
    not_found_count: number
    requested_count: number
    skipped_count: number
    updated_count: number
  }
}

export interface OrdersQuery {
  orderStatus?: string
  page: number
  pageSize: number
  paymentStatus?: string
  search?: string
  serviceCode?: string
  sortBy?: string
  sortDirection?: 'ASC' | 'DESC'
}

export async function createOrder(payload: CreateOrderPayload) {
  const response = await fetch('/api/v1/orders', {
    body: JSON.stringify(payload),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    const message = await readErrorMessage(response)
    throw new Error(message)
  }

  const result = (await response.json()) as OrderResponse
  return result.data
}

export async function fetchOrders(query: OrdersQuery) {
  const params = new URLSearchParams({
    page: String(query.page),
    page_size: String(query.pageSize),
  })
  appendParam(params, 'order_status', query.orderStatus)
  appendParam(params, 'payment_status', query.paymentStatus)
  appendParam(params, 'search', query.search)
  appendParam(params, 'service_code', query.serviceCode)
  appendParam(params, 'sort_by', query.sortBy)
  appendParam(params, 'sort_direction', query.sortDirection)

  const response = await fetch(`/api/v1/orders?${params.toString()}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('ORDER_LIST_FAILED')
  }

  return await response.json() as OrdersResponse
}

function appendParam(params: URLSearchParams, key: string, value?: string) {
  if (value && value !== 'ALL') {
    params.set(key, value)
  }
}

export async function fetchOrder(code: string) {
  const response = await fetch(`/api/v1/orders/${code}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('ORDER_NOT_FOUND')
  }

  const result = (await response.json()) as OrderResponse
  return result.data
}

export async function deleteOrder(code: string) {
  const response = await fetch(`/api/v1/orders/${code}`, {
    credentials: 'include',
    method: 'DELETE',
  })

  if (!response.ok) {
    const message = await readErrorMessage(response)
    throw new Error(message)
  }

  const result = (await response.json()) as OrderResponse
  return result.data
}

export async function updateOrderStatus(code: string, orderStatus: OrderStatus, notes: string) {
  const response = await fetch(`/api/v1/orders/${code}/status`, {
    body: JSON.stringify({
      notes,
      order_status: orderStatus,
    }),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'PATCH',
  })

  if (!response.ok) {
    const message = await readErrorMessage(response)
    throw new Error(message)
  }

  const result = (await response.json()) as OrderResponse
  return result.data
}

export async function updateOrder(code: string, payload: UpdateOrderPayload) {
  const response = await fetch(`/api/v1/orders/${code}`, {
    body: JSON.stringify(payload),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'PATCH',
  })

  if (!response.ok) {
    const message = await readErrorMessage(response)
    throw new Error(message)
  }

  const result = (await response.json()) as OrderResponse
  return result.data
}

export async function bulkUpdateOrderStatus(orderCodes: string[], orderStatus: OrderStatus, notes: string) {
  const response = await fetch('/api/v1/orders/bulk-status', {
    body: JSON.stringify({
      notes,
      order_codes: orderCodes,
      order_status: orderStatus,
    }),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'PATCH',
  })

  if (!response.ok) {
    const message = await readErrorMessage(response)
    throw new Error(message)
  }

  return await response.json() as BulkUpdateStatusResponse
}

async function readErrorMessage(response: Response) {
  try {
    const payload = await response.json() as { error?: { message?: string } }
    return payload.error?.message ?? 'Transaksi gagal dibuat.'
  } catch {
    return 'Transaksi gagal dibuat.'
  }
}
