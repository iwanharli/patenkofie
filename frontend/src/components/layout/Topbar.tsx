import { Coffee, LogOut, Menu, Plus, QrCode, Search, UserRound, Loader2, Package } from 'lucide-react'
import { type FormEvent, useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/features/auth/useAuth'
import { NotificationDropdown } from '@/features/notifications/NotificationDropdown'
import { fetchOrders, type OrderRecord } from '@/features/orders/ordersApi'
import { OrderStatusBadge, PaymentStatusBadge } from '@/features/orders/status'
import { useDebounce } from '@/hooks/useDebounce'
import { useClickOutside } from '@/hooks/useClickOutside'

interface TopbarProps {
  onOpenMobileSidebar: () => void
}

export function Topbar({ onOpenMobileSidebar }: TopbarProps) {
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const initials = getInitials(user?.name ?? user?.username ?? 'PA')

  const [topbarSearch, setTopbarSearch] = useState('')
  const [searchResults, setSearchResults] = useState<OrderRecord[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  
  const debouncedSearch = useDebounce(topbarSearch, 300)
  const searchContainerRef = useRef<HTMLDivElement>(null)

  useClickOutside(searchContainerRef, () => {
    setShowDropdown(false)
  })

  useEffect(() => {
    async function loadSearch() {
      const q = debouncedSearch.trim()
      if (!q) {
        setSearchResults([])
        return
      }

      setIsSearching(true)
      try {
        const response = await fetchOrders({ page: 1, pageSize: 5, search: q })
        setSearchResults(response.data)
      } catch (error) {
        // ignore errors for autocomplete
      } finally {
        setIsSearching(false)
      }
    }
    
    loadSearch()
  }, [debouncedSearch])

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
  }

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault()
    const query = topbarSearch.trim()
    if (!query) return

    if (query.toLowerCase().startsWith('paten-') || query.includes('-')) {
      navigate(`/orders/${query}`)
    } else {
      navigate(`/orders?search=${encodeURIComponent(query)}`)
    }
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="flex h-16 items-center gap-3 px-3 sm:px-4 lg:px-5">
        <Button
          aria-label="Buka menu"
          className="lg:hidden"
          onClick={onOpenMobileSidebar}
          size="icon"
          variant="ghost"
        >
          <Menu aria-hidden="true" className="size-5" />
        </Button>

        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="grid size-9 place-items-center rounded-md bg-primary text-primary-foreground lg:hidden">
            <Coffee aria-hidden="true" className="size-4" />
          </div>
          <div className="hidden min-w-0 flex-1 md:block" ref={searchContainerRef}>
            <form className="relative max-w-xl" onSubmit={handleSearchSubmit}>
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                className="pl-9"
                onChange={(e) => {
                  setTopbarSearch(e.target.value)
                  setShowDropdown(true)
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Cari pesanan, pelanggan, atau kode QR..."
                value={topbarSearch}
              />
              {showDropdown && topbarSearch.trim() !== '' && (
                <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md animate-in fade-in-80 slide-in-from-top-1">
                  {isSearching ? (
                    <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      Mencari...
                    </div>
                  ) : searchResults.length > 0 ? (
                    <ul className="max-h-[300px] overflow-auto py-1">
                      {searchResults.map((order) => (
                        <li key={order.order_code}>
                          <Link
                            to={`/orders/${order.order_code}`}
                            onClick={() => {
                              setShowDropdown(false)
                              setTopbarSearch('')
                            }}
                            className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted"
                          >
                            <div className="grid size-8 shrink-0 place-items-center rounded bg-secondary text-primary">
                              <Package className="size-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium leading-tight">{order.order_code}</p>
                              <p className="truncate text-xs text-muted-foreground">
                                {order.customer_name} • {order.service_name}
                              </p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <OrderStatusBadge status={order.order_status} />
                              <PaymentStatusBadge status={order.payment_status} />
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Pencarian tidak ditemukan.
                    </div>
                  )}
                </div>
              )}
            </form>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button aria-label="Scan QR" asChild size="icon" variant="ghost" className="shrink-0 text-muted-foreground hover:text-foreground">
                <Link to="/scan">
                  <QrCode aria-hidden="true" className="size-5" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Scan QR</TooltipContent>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2">
          <Button
            asChild
            className="hidden border border-primary/20 bg-primary text-primary-foreground shadow-sm hover:bg-[#265934] sm:inline-flex"
          >
            <Link to="/orders/new">
              <Plus aria-hidden="true" className="size-4" />
              Transaksi baru
            </Link>
          </Button>
          <NotificationDropdown />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Buka menu profil"
                className="size-9 rounded-full bg-[#2f4b6b] p-0 text-sm font-semibold text-white hover:bg-[#28415d] overflow-hidden"
              >
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt={user.name} className="size-full object-cover" />
                ) : (
                  initials
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <span className="block truncate">{user?.name ?? 'Pengguna'}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  @{user?.username ?? 'user'} · {user?.role ?? 'STAFF'}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to={`/settings/users/${user?.username ?? 'ilham'}`}>
                  <UserRound aria-hidden="true" className="size-4" />
                  Profil pengguna
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={handleLogout}>
                <LogOut aria-hidden="true" className="size-4" />
                Keluar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}

function getInitials(value: string) {
  const words = value.trim().split(/\s+/).filter(Boolean)
  const initials = words.length > 1 ? `${words[0][0]}${words[1][0]}` : value.slice(0, 2)

  return initials.toUpperCase()
}
