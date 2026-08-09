import { ChevronDown, Coffee, X } from 'lucide-react'
import { useState } from 'react'
import { Link, useLocation } from 'react-router'

import { navigationItems } from '@/components/layout/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/useAuth'
import { cn } from '@/lib/utils'

interface MobileSidebarProps {
  isOpen: boolean
  onClose: () => void
  appName?: string
}

export function MobileSidebar({ isOpen, onClose, appName }: MobileSidebarProps) {
  const location = useLocation()
  const { user } = useAuth()
  const [isSettingsOpen, setIsSettingsOpen] = useState(
    location.pathname.startsWith('/settings'),
  )

  const isActive = (href?: string) =>
    href ? (href === '/' ? location.pathname === '/' : location.pathname.startsWith(href)) : false

  return (
    <div
      aria-hidden={!isOpen}
      className={cn(
        'fixed inset-0 z-50 lg:hidden',
        isOpen ? 'pointer-events-auto' : 'pointer-events-none',
      )}
    >
      <div
        className={cn(
          'absolute inset-0 bg-black/35 transition-opacity',
          isOpen ? 'opacity-100' : 'opacity-0',
        )}
        onClick={onClose}
      />
      <aside
        aria-label="Menu utama"
        className={cn(
          'absolute inset-y-0 left-0 flex w-[min(18rem,calc(100vw-3rem))] flex-col border-r border-border bg-card shadow-xl transition-transform duration-200 ease-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center gap-3 border-b border-border px-4">
          <div className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
            <Coffee aria-hidden="true" className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold leading-5">{appName || 'PatenAndum'}</p>
            <p className="text-xs text-muted-foreground">Admin operasional</p>
          </div>
          <Button aria-label="Tutup menu" onClick={onClose} size="icon" variant="ghost">
            <X aria-hidden="true" className="size-5" />
          </Button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
          {navigationItems.map((item) => {
            const Icon = item.icon
            const showDivider = item.showDividerAbove

            if (item.children) {
              const filteredChildren = item.children.filter(
                (child) => !child.ownerOnly || user?.role === 'OWNER',
              )
              if (filteredChildren.length === 0) return null
              
              const isGroupActive = location.pathname.startsWith('/settings')

              return (
                <div className="space-y-1" key={item.label}>
                  {showDivider && <div className="my-1.5 border-t border-border/60" />}
                  <button
                    className={cn(
                      'flex h-11 w-full items-center justify-between rounded-md px-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
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
                              'flex h-9 items-center rounded-md px-3 text-xs font-medium transition-colors',
                              isChildActive
                                ? 'bg-primary font-semibold text-primary-foreground'
                                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                            )}
                            key={child.href}
                            onClick={onClose}
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
              <div className="w-full" key={item.label}>
                {showDivider && <div className="my-1.5 border-t border-border/60" />}
                <Link
                  className={cn(
                    'flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                    isActive(item.href) &&
                      'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                  )}
                  onClick={onClose}
                  to={item.href ?? '/'}
                >
                  <Icon aria-hidden="true" className="size-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </div>
            )
          })}
        </nav>
      </aside>
    </div>
  )
}
