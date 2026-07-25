import type { VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'

import { badgeVariants } from '@/components/ui/badge-variants'
import { cn } from '@/lib/utils'

export interface BadgeProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ className, variant }))} {...props} />
}
