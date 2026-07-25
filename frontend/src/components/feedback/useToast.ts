import { useContext } from 'react'

import { AppToastContext } from '@/components/feedback/toastStore'

export function useToast() {
  const context = useContext(AppToastContext)

  if (!context) {
    throw new Error('useToast must be used inside AppToastProvider')
  }

  return context
}
