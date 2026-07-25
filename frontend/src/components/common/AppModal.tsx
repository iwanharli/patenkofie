import type { ReactNode } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface AppModalProps {
  children: ReactNode
  className?: string
  description?: ReactNode
  footer?: ReactNode
  icon?: ReactNode
  onOpenChange?: (open: boolean) => void
  open?: boolean
  size?: 'lg' | 'md' | 'sm'
  title: ReactNode
  trigger?: ReactNode
}

const sizeClasses = {
  lg: 'max-w-2xl',
  md: 'max-w-lg',
  sm: 'max-w-sm',
}

export function AppModal({
  children,
  className,
  description,
  footer,
  icon,
  onOpenChange,
  open,
  size = 'md',
  title,
  trigger,
}: AppModalProps) {
  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={cn(sizeClasses[size], className)}>
        <DialogHeader className={icon ? 'grid grid-cols-[auto_1fr] gap-x-3 gap-y-1' : undefined}>
          {icon && (
            <div className="row-span-2 grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground">
              {icon}
            </div>
          )}
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div>{children}</div>
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  )
}
