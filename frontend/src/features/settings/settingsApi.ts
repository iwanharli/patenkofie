export interface BusinessProfileRecord {
  business_address: string
  business_name: string
  business_phone: string
  logo_url?: string
  receipt_footer: string
  updated_at: string
}

export interface UpdateBusinessProfilePayload {
  business_address: string
  business_name: string
  business_phone: string
  receipt_footer: string
}

export async function fetchBusinessProfile() {
  const response = await fetch('/api/v1/settings/profile', {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('Gagal memuat profil toko dari database.')
  }

  const payload = (await response.json()) as { data: BusinessProfileRecord }
  return payload.data
}

export async function uploadLogo(file: File) {
  const formData = new FormData()
  formData.append('logo', file)

  const response = await fetch('/api/v1/settings/profile/logo', {
    body: formData,
    credentials: 'include',
    method: 'POST',
  })

  if (!response.ok) {
    let errorMsg = 'Gagal mengunggah logo toko'
    try {
      const errPayload = await response.json()
      if (errPayload.error && errPayload.error.message) {
        errorMsg = errPayload.error.message
      }
    } catch {}
    throw new Error(errorMsg)
  }

  const payload = (await response.json()) as { data: { logo_url: string; message: string } }
  return payload.data
}

export async function updateBusinessProfile(payload: UpdateBusinessProfilePayload) {
  const response = await fetch('/api/v1/settings/profile', {
    body: JSON.stringify(payload),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'PATCH',
  })

  if (!response.ok) {
    const errorPayload = (await response.json()) as { error?: { message?: string } }
    throw new Error(errorPayload.error?.message ?? 'Gagal memperbarui profil toko.')
  }

  const result = (await response.json()) as { data: BusinessProfileRecord }
  return result.data
}

export function getDatabaseBackupUrl() {
  return '/api/v1/settings/backup'
}
