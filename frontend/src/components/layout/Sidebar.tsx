import {
  Banknote,
  Coffee,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { Link, useLocation } from 'react-router'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { navigationItems } from '@/components/layout/navigation'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const ToggleIcon = isCollapsed ? PanelLeftOpen : PanelLeftClose
  const isActive = (href: string) =>
    href === '/' ? location.pathname === '/' : location.pathname.startsWith(href)

  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 hidden border-r border-border bg-card transition-[width] duration-200 ease-out lg:flex lg:flex-col',
        isCollapsed ? 'w-20' : 'w-72',
      )}
    >
      <div className={cn('flex h-16 items-center border-b border-border', isCollapsed ? 'justify-center px-3' : 'gap-3 px-4')}>
        <div
          className={cn(
            'grid size-10 place-items-center rounded-md bg-primary text-primary-foreground',
            isCollapsed && 'hidden',
          )}
        >
          <Coffee aria-hidden="true" className="size-5" />
        </div>
        <div className={cn('min-w-0 flex-1', isCollapsed && 'hidden')}>
          <p className="text-base font-semibold leading-5">PatenAndum</p>
          <p className="text-xs text-muted-foreground">Admin operasional</p>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              aria-label={isCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
              onClick={onToggle}
              size="icon"
              variant="ghost"
            >
              <ToggleIcon aria-hidden="true" className="size-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">{isCollapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}</TooltipContent>
        </Tooltip>
      </div>

      <nav className={cn('flex flex-1 flex-col gap-1 py-4', isCollapsed ? 'px-3' : 'px-3')}>
        {navigationItems.map((item) => {
          const Icon = item.icon

          return (
            <Tooltip key={item.label}>
              <TooltipTrigger asChild>
                <Link
                  aria-label={item.label}
                  className={cn(
                    'flex h-10 w-full items-center rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                    isCollapsed ? 'justify-center px-0' : 'gap-3 px-3 text-left',
                    isActive(item.href) &&
                      'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                  )}
                  to={item.href}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span className={cn(isCollapsed && 'sr-only')}>{item.label}</span>
                </Link>
              </TooltipTrigger>
              {isCollapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
            </Tooltip>
          )
        })}
      </nav>

      <div className={cn('border-t border-border', isCollapsed ? 'p-3' : 'p-4')}>
        {isCollapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="grid size-10 place-items-center rounded-md border border-border bg-background text-primary">
                <Banknote aria-hidden="true" className="size-5" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right">Kas hari ini Rp1.820.000</TooltipContent>
          </Tooltip>
        ) : (
        <div className="rounded-lg border border-border bg-background p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Kas hari ini</p>
            <Badge variant="success">Tunai</Badge>
          </div>
          <p className="mt-3 text-2xl font-semibold">Rp1.820.000</p>
          <p className="mt-1 text-xs text-muted-foreground">8 pembayaran tercatat</p>
        </div>
        )}
      </div>
    </aside>
  )
}
