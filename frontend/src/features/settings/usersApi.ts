export interface UserRecord {
  avatar_url?: string
  created_at: string
  id: number
  is_active: boolean
  name: string
  role: 'OWNER' | 'STAFF'
  updated_at: string
  username: string
}

interface UsersResponse {
  data: UserRecord[]
  meta: {
    page: number
    page_size: number
    total_items: number
  }
}

interface UserDetailResponse {
  data: UserRecord
}

export interface CreateUserPayload {
  name: string
  password?: string
  role: 'OWNER' | 'STAFF'
  username: string
}

export interface UpdateUserPayload {
  is_active: boolean
  name: string
  role: 'OWNER' | 'STAFF'
}

export async function fetchUsers(page = 1, pageSize = 10) {
  const params = new URLSearchParams({
    page: String(page),
    page_size: String(pageSize),
  })

  const response = await fetch(`/api/v1/users?${params.toString()}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('USER_LIST_FAILED')
  }

  return (await response.json()) as UsersResponse
}

export async function fetchUser(username: string) {
  const response = await fetch(`/api/v1/users/${username}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('USER_NOT_FOUND')
  }

  const result = (await response.json()) as UserDetailResponse
  return result.data
}

export async function createUser(payload: CreateUserPayload) {
  const response = await fetch('/api/v1/users', {
    body: JSON.stringify(payload),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new Error(errorPayload.error?.message ?? 'Gagal membuat pengguna')
  }

  const result = (await response.json()) as UserDetailResponse
  return result.data
}

export async function updateUser(username: string, payload: UpdateUserPayload) {
  const response = await fetch(`/api/v1/users/${username}`, {
    body: JSON.stringify(payload),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'PATCH',
  })

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new Error(errorPayload.error?.message ?? 'Gagal memperbarui pengguna')
  }

  const result = (await response.json()) as UserDetailResponse
  return result.data
}

export async function resetUserPassword(username: string, newPassword: string) {
  const response = await fetch(`/api/v1/users/${username}/reset-password`, {
    body: JSON.stringify({ new_password: newPassword }),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => ({}))) as { error?: { message?: string } }
    throw new Error(errorPayload.error?.message ?? 'Gagal mereset password')
  }

  const payload = (await response.json()) as { data: { message: string } }
  return payload.data.message
}

export async function uploadAvatar(username: string, file: File) {
  const formData = new FormData()
  formData.append('avatar', file)

  const response = await fetch(`/api/v1/users/${username}/avatar`, {
    body: formData,
    credentials: 'include',
    method: 'POST',
  })

  if (!response.ok) {
    let errorMsg = 'Gagal mengunggah foto profil'
    try {
      const errPayload = await response.json()
      if (errPayload.error && errPayload.error.message) {
        errorMsg = errPayload.error.message
      }
    } catch {}
    throw new Error(errorMsg)
  }

  const payload = (await response.json()) as { data: { avatar_url: string; message: string } }
  return payload.data
}
