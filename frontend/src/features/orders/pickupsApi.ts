export interface PickupRecord {
  handed_over_by: number
  handed_over_name: string
  id: number
  notes: string | null
  order_code: string
  photo_path: string
  picked_up_at: string
  recipient_name: string
  recipient_phone: string | null
  recipient_type: 'CUSTOMER' | 'REPRESENTATIVE'
}

interface PickupResponse {
  data: PickupRecord
}

export async function fetchPickup(orderCode: string) {
  const response = await fetch(`/api/v1/orders/${orderCode}/pickup`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('PICKUP_NOT_FOUND')
  }

  const result = (await response.json()) as PickupResponse
  return result.data
}

export async function createPickup(orderCode: string, payload: FormData) {
  const response = await fetch(`/api/v1/orders/${orderCode}/pickup`, {
    body: payload,
    credentials: 'include',
    method: 'POST',
  })

  if (!response.ok) {
    const message = await readErrorMessage(response)
    throw new Error(message)
  }

  const result = (await response.json()) as PickupResponse
  return result.data
}

async function readErrorMessage(response: Response) {
  try {
    const payload = await response.json() as { error?: { message?: string } }
    return payload.error?.message ?? 'Bukti pengambilan gagal disimpan.'
  } catch {
    return 'Bukti pengambilan gagal disimpan.'
  }
}
