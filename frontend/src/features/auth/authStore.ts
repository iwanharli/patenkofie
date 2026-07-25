import { createContext } from 'react'

import type { AuthUser } from '@/features/auth/authApi'

export interface AuthContextValue {
  checkSession: () => Promise<AuthUser | null>
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  user: AuthUser | null
}

export const AuthContext = createContext<AuthContextValue | null>(null)
