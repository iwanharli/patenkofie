import type { OrderStatus, PaymentStatus } from '@/features/orders/ordersApi'

export type PaymentType = 'DOWN_PAYMENT' | 'FULL_PAYMENT' | 'REMAINING_PAYMENT'

export interface PaymentRecord {
  amount: number
  customer_name: string
  id: number
  notes: string | null
  order_code: string
  order_id: number
  order_paid: number
  order_payment_status: PaymentStatus
  order_remaining: number
  order_status: OrderStatus
  order_total: number
  paid_at: string
  payment_code: string
  payment_method: 'CASH'
  payment_type: PaymentType
  received_by: number
  received_by_name: string
}

interface PaymentsResponse {
  data: PaymentRecord[]
  meta: {
    page: number
    page_size: number
    total_items: number
  }
  summary: {
    cash_today: number
    outstanding_count: number
    outstanding_total: number
    payments_today: number
    total_payments: number
  }
}

interface PaymentResponse {
  data: PaymentRecord
}

export async function fetchPayments(query: { page: number; pageSize: number }) {
  const params = new URLSearchParams({
    page: String(query.page),
    page_size: String(query.pageSize),
  })

  const response = await fetch(`/api/v1/payments?${params.toString()}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('PAYMENT_LIST_FAILED')
  }

  return await response.json() as PaymentsResponse
}

export async function fetchPayment(code: string) {
  const response = await fetch(`/api/v1/payments/${code}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('PAYMENT_NOT_FOUND')
  }

  const result = (await response.json()) as PaymentResponse
  return result.data
}

export async function settleOrderPayment(orderCode: string, notes: string) {
  const response = await fetch(`/api/v1/orders/${orderCode}/payments/settle`, {
    body: JSON.stringify({ notes }),
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

  const result = (await response.json()) as PaymentResponse
  return result.data
}

async function readErrorMessage(response: Response) {
  try {
    const payload = await response.json() as { error?: { message?: string } }
    return payload.error?.message ?? 'Pembayaran gagal disimpan.'
  } catch {
    return 'Pembayaran gagal disimpan.'
  }
}
