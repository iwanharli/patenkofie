import { createContext } from 'react'
import type { ReactNode } from 'react'

export type AppToastVariant = 'destructive' | 'info' | 'success' | 'warning'

export interface AppToastAction {
  label: string
  onClick: () => void
}

export interface AppToastInput {
  action?: AppToastAction
  description?: ReactNode
  title: ReactNode
  variant?: AppToastVariant
}

export interface AppToastItem extends AppToastInput {
  id: string
  variant: AppToastVariant
}

export interface AppToastContextValue {
  dismissToast: (id: string) => void
  toast: (input: AppToastInput) => string
}

export const AppToastContext = createContext<AppToastContextValue | null>(null)
