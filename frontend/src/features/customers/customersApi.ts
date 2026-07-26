export interface CustomerSuggestionRecord {
  address: string | null
  created_at: string
  id: number
  last_order_at: string | null
  name: string
  notes: string | null
  phone: string | null
  total_orders: number
  total_weight_kg: string
}

export interface CustomerRecord {
  address: string | null
  created_at: string
  id: number
  last_order_at: string | null
  name: string
  notes: string | null
  phone: string | null
  receivable: number
  total_orders: number
  total_spent: number
  total_weight_kg: string
}

export interface CustomerOrderRecord {
  created_at: string
  id: number
  order_code: string
  order_status: string
  paid_amount: number
  payment_status: string
  remaining: number
  service_code: string
  service_name: string
  total_amount: number
  weight_kg: string
}

interface CustomerSuggestionsResponse {
  data: CustomerSuggestionRecord[]
}

interface CustomersResponse {
  data: CustomerRecord[]
  meta: {
    page: number
    page_size: number
    total_items: number
  }
}

interface CustomerDetailResponse {
  data: CustomerRecord & {
    orders: CustomerOrderRecord[]
    orders_meta: {
      page: number
      page_size: number
      total_items: number
    }
  }
}

export interface CustomersQuery {
  page: number
  pageSize: number
  search?: string
}

export async function fetchCustomerSuggestions(search: string) {
  const params = new URLSearchParams({
    limit: '6',
    search,
  })

  const response = await fetch(`/api/v1/customers/suggestions?${params.toString()}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('CUSTOMER_SUGGESTIONS_FAILED')
  }

  const result = (await response.json()) as CustomerSuggestionsResponse
  return result.data
}

export async function fetchCustomers(query: CustomersQuery) {
  const params = new URLSearchParams({
    page: String(query.page),
    page_size: String(query.pageSize),
  })
  if (query.search) {
    params.set('search', query.search)
  }

  const response = await fetch(`/api/v1/customers?${params.toString()}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('CUSTOMER_LIST_FAILED')
  }

  return (await response.json()) as CustomersResponse
}

export async function fetchCustomer(id: number, ordersPage = 1, ordersPageSize = 10) {
  const params = new URLSearchParams({
    orders_page: String(ordersPage),
    orders_page_size: String(ordersPageSize),
  })

  const response = await fetch(`/api/v1/customers/${id}?${params.toString()}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('CUSTOMER_NOT_FOUND')
  }

  const result = (await response.json()) as CustomerDetailResponse
  return result.data
}

export interface UpdateCustomerPayload {
  address: string
  name: string
  notes: string
  phone: string
}

export async function updateCustomer(id: number, payload: UpdateCustomerPayload) {
  const response = await fetch(`/api/v1/customers/${id}`, {
    body: JSON.stringify(payload),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'PATCH',
  })

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new Error(errorPayload.error?.message ?? 'Gagal memperbarui pelanggan')
  }

  const result = (await response.json()) as { data: CustomerRecord }
  return result.data
}

