export interface ServiceRecord {
  code: string
  id: number
  is_active: boolean
  name: string
  price_per_kg: number
  updated_at: string
  updated_by: string
  today_orders: number
  today_weight: number
  today_revenue: number
}

interface ApiResponse<T> {
  data: T
}

export async function fetchServices() {
  const response = await fetch('/api/v1/services', {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Data layanan gagal dimuat')
  }

  const payload = (await response.json()) as ApiResponse<ServiceRecord[]>
  return payload.data
}

export async function fetchService(code: string) {
  const response = await fetch(`/api/v1/services/${code}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Data layanan gagal dimuat')
  }

  const payload = (await response.json()) as ApiResponse<ServiceRecord>
  return payload.data
}

export async function updateService(code: string, data: { price_per_kg?: number; is_active?: boolean }) {
  const response = await fetch(`/api/v1/services/${code}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Gagal memperbarui harga layanan')
  }

  const payload = (await response.json()) as ApiResponse<ServiceRecord>
  return payload.data
}

