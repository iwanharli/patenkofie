import { Bell, Check, Loader2, ArrowRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  fetchNotifications,
  markAllNotificationsAsRead,
  type NotificationRecord,
} from '@/features/notifications/notificationsApi'
import { formatDistanceToNow } from 'date-fns'
import { id } from 'date-fns/locale'

export function NotificationDropdown() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  const unreadCount = notifications.filter((n) => !n.is_read).length

  async function loadNotifications() {
    try {
      setIsLoading(true)
      const data = await fetchNotifications()
      setNotifications(data)
    } catch (error) {
      console.error('Failed to load notifications', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
    // Poll every 30 seconds
    const interval = setInterval(loadNotifications, 30000)
    return () => clearInterval(interval)
  }, [])

  async function handleMarkAllAsRead() {
    try {
      await markAllNotificationsAsRead()
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } catch (error) {
      console.error('Failed to mark all as read', error)
    }
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button aria-label="Notifikasi" size="icon" variant="ghost" className="relative">
              <Bell aria-hidden="true" className="size-5" />
              {unreadCount > 0 && (
                <span className="absolute right-2 top-2 flex size-2.5 rounded-full bg-destructive" />
              )}
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>Notifikasi</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          Notifikasi
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
              {unreadCount} baru
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[300px] overflow-auto">
          {isLoading && notifications.length === 0 ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Belum ada notifikasi
            </div>
          ) : (
            notifications.map((notif) => (
              <DropdownMenuItem
                key={notif.id}
                className={`flex flex-col items-start gap-1 whitespace-normal p-3 ${
                  !notif.is_read ? 'bg-muted/50' : ''
                }`}
              >
                <div className="flex w-full items-start justify-between gap-2">
                  <span className="font-semibold leading-tight">{notif.title}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: id })}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{notif.message}</p>
              </DropdownMenuItem>
            ))
          )}
        </div>
        {unreadCount > 0 && (
          <>
            <DropdownMenuSeparator />
            <div className="p-1">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-center text-xs"
                onClick={(e) => {
                  e.preventDefault()
                  handleMarkAllAsRead()
                }}
              >
                <Check className="mr-2 size-3" />
                Tandai semua dibaca
              </Button>
            </div>
          </>
        )}
        <DropdownMenuSeparator />
        <div className="p-1">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-full justify-center text-xs text-primary hover:text-primary"
            onClick={() => setIsOpen(false)}
          >
            <Link to="/notifications">
              Lihat semua notifikasi
              <ArrowRight className="ml-2 size-3" />
            </Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
