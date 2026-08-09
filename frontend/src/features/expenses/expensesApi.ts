import { z } from 'zod'

export type ExpenseCategory = 'OPERASIONAL' | 'BAHAN_BAKU' | 'LAINNYA'

export interface ExpenseRecord {
  amount: number
  category: ExpenseCategory
  created_at: string
  created_by: number
  description: string
  expense_date: string
  id: number
  updated_at: string
}

export interface CreateExpensePayload {
  amount: number
  category: ExpenseCategory
  description: string
  expense_date: string
}

export type UpdateExpensePayload = CreateExpensePayload

export const expenseSchema = z.object({
  amount: z.coerce.number().min(1, 'Nominal kas kecil harus lebih dari 0'),
  category: z.enum(['OPERASIONAL', 'BAHAN_BAKU', 'LAINNYA']),
  description: z.string().min(1, 'Keterangan tidak boleh kosong'),
  expense_date: z.string().min(1, 'Pilih tanggal pengeluaran'),
})

export type ExpenseFormData = z.infer<typeof expenseSchema>

interface ExpenseResponse {
  data: ExpenseRecord
}

export interface ExpensesMeta {
  page: number
  page_size: number
  total_amount: number
  total_items: number
}

export interface ExpensesResponse {
  data: ExpenseRecord[]
  meta: ExpensesMeta
}

export async function fetchExpenses(query?: {
  endDate?: string
  page?: number
  pageSize?: number
  startDate?: string
}) {
  const params = new URLSearchParams()
  if (query?.startDate) {
    params.set('start_date', query.startDate)
  }
  if (query?.endDate) {
    params.set('end_date', query.endDate)
  }
  params.set('page', String(query?.page ?? 1))
  params.set('page_size', String(query?.pageSize ?? 10))

  const response = await fetch(`/api/v1/expenses?${params.toString()}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Gagal memuat data kas kecil.')
  }

  return (await response.json()) as ExpensesResponse
}

export async function createExpense(payload: CreateExpensePayload) {
  const response = await fetch('/api/v1/expenses', {
    body: JSON.stringify(payload),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error('Gagal mencatat kas kecil.')
  }

  const result = (await response.json()) as ExpenseResponse
  return result.data
}

export async function updateExpense(id: number, payload: UpdateExpensePayload) {
  const response = await fetch(`/api/v1/expenses/${id}`, {
    body: JSON.stringify(payload),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'PATCH',
  })

  if (!response.ok) {
    throw new Error('Gagal memperbarui kas kecil.')
  }

  const result = (await response.json()) as ExpenseResponse
  return result.data
}

export async function deleteExpense(id: number) {
  const response = await fetch(`/api/v1/expenses/${id}`, {
    credentials: 'include',
    method: 'DELETE',
  })

  if (!response.ok) {
    throw new Error('Gagal menghapus kas kecil.')
  }
}
