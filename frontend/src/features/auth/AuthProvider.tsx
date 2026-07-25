import type { PropsWithChildren } from 'react'
import { useCallback, useMemo, useState } from 'react'

import { fetchCurrentUser, loginRequest, logoutRequest, type AuthUser } from '@/features/auth/authApi'
import { AuthContext, type AuthContextValue } from '@/features/auth/authStore'

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const checkSession = useCallback(async () => {
    setIsLoading(true)

    try {
      const currentUser = await fetchCurrentUser()
      setUser(currentUser)
      return currentUser
    } catch {
      setUser(null)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      checkSession,
      isLoading,
      login: async (username, password) => {
        const loggedInUser = await loginRequest(username, password)
        setUser(loggedInUser)
      },
      logout: async () => {
        await logoutRequest()
        setUser(null)
      },
      user,
    }),
    [checkSession, isLoading, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
