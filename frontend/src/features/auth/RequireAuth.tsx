import type { PropsWithChildren } from 'react'
import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router'

import { useAuth } from '@/features/auth/useAuth'

export function RequireAuth({ children }: PropsWithChildren) {
  const location = useLocation()
  const { checkSession, isLoading, user } = useAuth()
  const [hasCheckedSession, setHasCheckedSession] = useState(Boolean(user))

  useEffect(() => {
    let isMounted = true

    if (user) {
      setHasCheckedSession(true)
      return
    }

    setHasCheckedSession(false)
    checkSession().finally(() => {
      if (isMounted) {
        setHasCheckedSession(true)
      }
    })

    return () => {
      isMounted = false
    }
  }, [checkSession, user])

  if (isLoading || !hasCheckedSession) {
    return (
      <main className="grid min-h-svh place-items-center bg-background px-4">
        <div className="text-center">
          <div className="mx-auto mb-3 grid size-11 place-items-center rounded-md bg-primary text-sm font-semibold text-primary-foreground">
            PA
          </div>
          <p className="text-sm font-medium text-muted-foreground">Memeriksa sesi...</p>
        </div>
      </main>
    )
  }

  if (!user) {
    return <Navigate replace state={{ from: location }} to="/login" />
  }

  return children
}
