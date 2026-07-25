export interface AuthUser {
  id: number
  name: string
  role: string
  username: string
}

interface AuthResponse {
  data: {
    user: AuthUser
  }
}

export async function loginRequest(username: string, password: string) {
  const response = await fetch('/api/v1/auth/login', {
    body: JSON.stringify({ username, password }),
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error('LOGIN_FAILED')
  }

  const payload = (await response.json()) as AuthResponse
  return payload.data.user
}

export async function fetchCurrentUser() {
  const response = await fetch('/api/v1/auth/me', {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('UNAUTHENTICATED')
  }

  const payload = (await response.json()) as AuthResponse
  return payload.data.user
}

export async function logoutRequest() {
  await fetch('/api/v1/auth/logout', {
    credentials: 'include',
    method: 'POST',
  })
}
