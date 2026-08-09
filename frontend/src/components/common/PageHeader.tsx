import type { ReactNode } from 'react'

interface PageHeaderProps {
  actions?: ReactNode
  description?: string
  eyebrow?: string
  title: ReactNode
}

export function PageHeader({ actions, description, eyebrow, title }: PageHeaderProps) {
  return (
    <section className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 space-y-1">
        {eyebrow && (
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
        )}
        <h1 className="text-xl font-semibold leading-tight tracking-normal">{title}</h1>
        {description && <p className="max-w-2xl text-sm leading-5 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">{actions}</div>}
    </section>
  )
}
