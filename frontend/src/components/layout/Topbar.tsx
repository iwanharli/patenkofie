import { Bell, Coffee, LogOut, Menu, Plus, Search, Settings, UserRound } from 'lucide-react'
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

interface TopbarProps {
  onOpenMobileSidebar: () => void
}

export function Topbar({ onOpenMobileSidebar }: TopbarProps) {
  const navigate = useNavigate()
  const { logout, user } = useAuth()
  const initials = getInitials(user?.name ?? user?.username ?? 'PA')

  async function handleLogout() {
    await logout()
    navigate('/login', { replace: true })
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
          <div className="hidden min-w-0 flex-1 md:block">
            <div className="relative max-w-xl">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input className="pl-9" placeholder="Cari pesanan, pelanggan, atau kode QR" />
            </div>
          </div>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <Button aria-label="Notifikasi" size="icon" variant="ghost">
                <Bell aria-hidden="true" className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Notifikasi</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button aria-label="Pengaturan" asChild size="icon" variant="ghost">
                <Link to="/settings/services">
                  <Settings aria-hidden="true" className="size-5" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Pengaturan</TooltipContent>
          </Tooltip>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                aria-label="Buka menu profil"
                className="size-9 bg-[#2f4b6b] p-0 text-sm font-semibold text-white hover:bg-[#28415d]"
              >
                {initials}
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
