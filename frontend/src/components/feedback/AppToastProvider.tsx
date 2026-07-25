import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react'
import type { PropsWithChildren } from 'react'
import { useCallback, useMemo, useState } from 'react'

import {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'
import {
  AppToastContext,
  type AppToastContextValue,
  type AppToastInput,
  type AppToastItem,
  type AppToastVariant,
} from '@/components/feedback/toastStore'
import { cn } from '@/lib/utils'

const TOAST_LIMIT = 4

const variantStyles: Record<AppToastVariant, string> = {
  destructive: 'border-destructive/30 bg-destructive/10 text-foreground',
  info: 'border-[#2f4b6b]/25 bg-[#2f4b6b]/10 text-foreground',
  success: 'border-primary/25 bg-primary/10 text-foreground',
  warning: 'border-amber-300 bg-amber-50 text-foreground',
}

const iconStyles: Record<AppToastVariant, string> = {
  destructive: 'bg-destructive/15 text-destructive',
  info: 'bg-[#2f4b6b]/15 text-[#2f4b6b]',
  success: 'bg-primary/15 text-primary',
  warning: 'bg-amber-100 text-amber-700',
}

const icons = {
  destructive: AlertCircle,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
}

export function AppToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<AppToastItem[]>([])

  const dismissToast = useCallback((id: string) => {
    setToasts((currentToasts) => currentToasts.filter((toastItem) => toastItem.id !== id))
  }, [])

  const toast = useCallback((input: AppToastInput) => {
    const id = createToastId()

    setToasts((currentToasts) => [
      {
        ...input,
        id,
        variant: input.variant ?? 'info',
      },
      ...currentToasts,
    ].slice(0, TOAST_LIMIT))

    return id
  }, [])

  const value = useMemo<AppToastContextValue>(() => ({ dismissToast, toast }), [dismissToast, toast])

  return (
    <AppToastContext.Provider value={value}>
      <ToastProvider duration={4500} swipeDirection="right">
        {children}
        {toasts.map((toastItem) => {
          const Icon = icons[toastItem.variant]

          return (
            <Toast
              className={cn(
                'relative grid grid-cols-[auto_1fr_auto] items-start gap-x-3 gap-y-1 overflow-hidden pr-9',
                variantStyles[toastItem.variant],
              )}
              key={toastItem.id}
              onOpenChange={(open) => {
                if (!open) {
                  dismissToast(toastItem.id)
                }
              }}
            >
              <div className={cn('mt-0.5 grid size-8 place-items-center rounded-md', iconStyles[toastItem.variant])}>
                <Icon aria-hidden="true" className="size-4" />
              </div>
              <div className="min-w-0">
                <ToastTitle>{toastItem.title}</ToastTitle>
                {toastItem.description && <ToastDescription>{toastItem.description}</ToastDescription>}
              </div>
              {toastItem.action && (
                <ToastAction
                  altText={toastItem.action.label}
                  className="mt-0.5 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
                  onClick={toastItem.action.onClick}
                >
                  {toastItem.action.label}
                </ToastAction>
              )}
              <ToastClose aria-label="Tutup notifikasi" />
            </Toast>
          )
        })}
        <ToastViewport />
      </ToastProvider>
    </AppToastContext.Provider>
  )
}

function createToastId() {
  if ('crypto' in window && 'randomUUID' in window.crypto) {
    return window.crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
