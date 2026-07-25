import { Coffee, X } from 'lucide-react'
import { Link, useLocation } from 'react-router'

import { Button } from '@/components/ui/button'
import { navigationItems } from '@/components/layout/navigation'
import { cn } from '@/lib/utils'

interface MobileSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function MobileSidebar({ isOpen, onClose }: MobileSidebarProps) {
  const location = useLocation()
  const isActive = (href: string) =>
    href === '/' ? location.pathname === '/' : location.pathname.startsWith(href)

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
            <p className="text-base font-semibold leading-5">PatenAndum</p>
            <p className="text-xs text-muted-foreground">Admin operasional</p>
          </div>
          <Button aria-label="Tutup menu" onClick={onClose} size="icon" variant="ghost">
            <X aria-hidden="true" className="size-5" />
          </Button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {navigationItems.map((item) => {
            const Icon = item.icon

            return (
              <Link
                className={cn(
                  'flex h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground',
                  isActive(item.href) &&
                    'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                )}
                key={item.label}
                onClick={onClose}
                to={item.href}
              >
                <Icon aria-hidden="true" className="size-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>
    </div>
  )
}
