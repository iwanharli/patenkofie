import type { LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

const toneClassNames = {
  amber: 'bg-[#fff7d6] text-[#8a6300]',
  blue: 'bg-[#e3eef9] text-[#245b8c]',
  green: 'bg-[#e3f1e6] text-[#2f6b3f]',
  red: 'bg-[#fde7e5] text-[#9d2b22]',
}

interface MetricCardProps {
  detail: string
  icon: LucideIcon
  label: string
  tone: keyof typeof toneClassNames
  value: string
}

export function MetricCard({ detail, icon: Icon, label, tone, value }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-4 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-normal">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
        </div>
        <div className={cn('grid size-10 shrink-0 place-items-center rounded-md', toneClassNames[tone])}>
          <Icon aria-hidden="true" className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}
