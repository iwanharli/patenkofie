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

interface CustomerSuggestionsResponse {
  data: CustomerSuggestionRecord[]
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
