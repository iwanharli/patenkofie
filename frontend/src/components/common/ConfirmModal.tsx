import { AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'

import { AppModal } from '@/components/common/AppModal'
import { Button } from '@/components/ui/button'
import { DialogClose } from '@/components/ui/dialog'

interface ConfirmModalProps {
  cancelLabel?: string
  children?: ReactNode
  confirmLabel?: string
  description?: ReactNode
  onConfirm: () => void
  title: ReactNode
  trigger: ReactNode
  variant?: 'default' | 'destructive'
}

export function ConfirmModal({
  cancelLabel = 'Batal',
  children,
  confirmLabel = 'Lanjutkan',
  description,
  onConfirm,
  title,
  trigger,
  variant = 'default',
}: ConfirmModalProps) {
  return (
    <AppModal
      description={description}
      footer={
        <>
          <DialogClose asChild>
            <Button variant="outline">{cancelLabel}</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={onConfirm} variant={variant === 'destructive' ? 'destructive' : 'default'}>
              {confirmLabel}
            </Button>
          </DialogClose>
        </>
      }
      icon={<AlertTriangle aria-hidden="true" className="size-5" />}
      size="sm"
      title={title}
      trigger={trigger}
    >
      {children}
    </AppModal>
  )
}
