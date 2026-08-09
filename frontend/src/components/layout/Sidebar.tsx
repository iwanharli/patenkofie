import {
  Banknote,
  ChevronDown,
  Coffee,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'

import { navigationItems } from '@/components/layout/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/features/auth/useAuth'
import { fetchDashboardOverview } from '@/features/dashboard/dashboardApi'
import { cn } from '@/lib/utils'
import { formatRupiah } from '@/utils/format'

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
  appName?: string
}

export function Sidebar({ isCollapsed, onToggle, appName }: SidebarProps) {
  const location = useLocation()
  const { user } = useAuth()
  const [isSettingsOpen, setIsSettingsOpen] = useState(
    location.pathname.startsWith('/settings'),
  )
  const [cashSummary, setCashSummary] = useState({ amount: 0, payments: 0 })

  useEffect(() => {
    fetchDashboardOverview()
      .then(data => {
        setCashSummary({
          amount: data.summary.cash_amount_today,
          payments: data.summary.cash_payments_today
        })
      })
      .catch(() => {})
  }, [])

  const ToggleIcon = isCollapsed ? PanelLeftOpen : PanelLeftClose
  const isActive = (href?: string) =>
    href ? (href === '/' ? location.pathname === '/' : location.pathname.startsWith(href)) : false

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
          <p className="text-base font-semibold leading-5">{appName || 'PatenAndum'}</p>
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

      <nav className={cn('flex flex-1 flex-col gap-1 overflow-y-auto py-4', isCollapsed ? 'px-3' : 'px-3')}>
        {navigationItems.map((item) => {
          const Icon = item.icon
          const showDivider = item.showDividerAbove

          if (item.children) {
            const filteredChildren = item.children.filter(
              (child) => !child.ownerOnly || user?.role === 'OWNER',
            )
            if (filteredChildren.length === 0) return null

            const isGroupActive = location.pathname.startsWith('/settings')

            if (isCollapsed) {
              return (
                <div key={item.label} className="w-full">
                  {showDivider && <div className="my-1.5 border-t border-border/60" />}
                  <DropdownMenu>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <button
                            aria-label={item.label}
                            className={cn(
                              'flex h-10 w-full items-center justify-center rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                              isGroupActive &&
                                'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                            )}
                            type="button"
                          >
                            <Icon aria-hidden="true" className="size-4 shrink-0" />
                          </button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="right">{item.label}</TooltipContent>
                    </Tooltip>
                    <DropdownMenuContent side="right" sideOffset={8}>
                      {filteredChildren.map((child) => (
                        <DropdownMenuItem asChild key={child.href}>
                          <Link
                            className={cn(
                              'w-full cursor-pointer text-xs font-medium',
                              location.pathname === child.href && 'font-bold text-primary',
                            )}
                            to={child.href}
                          >
                            {child.label}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )
            }

            return (
              <div className="space-y-1" key={item.label}>
                {showDivider && <div className="my-1.5 border-t border-border/60" />}
                <button
                  className={cn(
                    'flex h-10 w-full items-center justify-between rounded-md px-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                    isGroupActive && 'bg-primary/10 font-semibold text-primary',
                  )}
                  onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                  type="button"
                >
                  <div className="flex items-center gap-3">
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn('size-4 transition-transform duration-200', isSettingsOpen && 'rotate-180')}
                  />
                </button>

                {isSettingsOpen && (
                  <div className="ml-4 flex flex-col gap-1 border-l border-border/80 py-1 pl-3">
                    {filteredChildren.map((child) => {
                      const isChildActive = location.pathname === child.href
                      return (
                        <Link
                          className={cn(
                            'flex h-8 items-center rounded-md px-2.5 text-xs font-medium transition-colors',
                            isChildActive
                              ? 'bg-primary font-semibold text-primary-foreground'
                              : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                          )}
                          key={child.href}
                          to={child.href}
                        >
                          {child.label}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          }

          return (
            <div key={item.label} className="w-full">
              {showDivider && <div className="my-1.5 border-t border-border/60" />}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    aria-label={item.label}
                    className={cn(
                      'flex h-10 w-full items-center rounded-md text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                      isCollapsed ? 'justify-center px-0' : 'gap-3 px-3 text-left',
                      isActive(item.href) &&
                        'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                    )}
                    to={item.href ?? '/'}
                  >
                    <Icon aria-hidden="true" className="size-4 shrink-0" />
                    <span className={cn(isCollapsed && 'sr-only')}>{item.label}</span>
                  </Link>
                </TooltipTrigger>
                {isCollapsed && <TooltipContent side="right">{item.label}</TooltipContent>}
              </Tooltip>
            </div>
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
            <TooltipContent side="right">Kas hari ini {formatRupiah(cashSummary.amount)}</TooltipContent>
          </Tooltip>
        ) : (
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Kas hari ini</p>
              <Badge variant="success">Tunai</Badge>
            </div>
            <p className="mt-3 text-2xl font-semibold">{formatRupiah(cashSummary.amount)}</p>
            <p className="mt-1 text-xs text-muted-foreground">{cashSummary.payments} pembayaran tercatat</p>
          </div>
        )}
      </div>
    </aside>
  )
}
