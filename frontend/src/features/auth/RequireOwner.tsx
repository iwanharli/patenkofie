import type { PropsWithChildren } from 'react'
import { Navigate } from 'react-router'

import { useAuth } from '@/features/auth/useAuth'

export function RequireOwner({ children }: PropsWithChildren) {
  const { user } = useAuth()

  if (user?.role !== 'OWNER') {
    return <Navigate replace to="/" />
  }

  return children
}
