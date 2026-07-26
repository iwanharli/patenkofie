import { Bell, Check, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { formatDistanceToNow, format } from 'date-fns'
import { id } from 'date-fns/locale'

import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { fetchNotifications, markAllNotificationsAsRead, type NotificationRecord } from '@/features/notifications/notificationsApi'

export function NotificationListPage() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  const unreadCount = notifications.filter((n) => !n.is_read).length

  async function loadNotifications() {
    try {
      setIsLoading(true)
      const data = await fetchNotifications()
      setNotifications(data)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Gagal memuat notifikasi')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadNotifications()
    const interval = setInterval(loadNotifications, 60000)
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
    <>
      <PageHeader
        actions={
          unreadCount > 0 && (
            <Button variant="outline" onClick={handleMarkAllAsRead}>
              <Check className="mr-2 size-4" />
              Tandai semua dibaca
            </Button>
          )
        }
        description="Pantau riwayat pemberitahuan, aktivitas, dan peringatan keamanan akun Anda."
        title="Pusat Notifikasi"
      />

      <Card>
        <CardContent className="p-0">
          {isLoading && notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
              <p className="mt-4 text-sm text-muted-foreground">Memuat riwayat notifikasi...</p>
            </div>
          ) : errorMessage ? (
            <div className="py-12 text-center text-sm text-destructive">{errorMessage}</div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="grid size-12 place-items-center rounded-full bg-muted">
                <Bell className="size-6 text-muted-foreground" />
              </div>
              <p className="mt-4 text-base font-semibold">Belum ada pemberitahuan</p>
              <p className="mt-1 text-sm text-muted-foreground">Notifikasi baru akan muncul di sini.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {notifications.map((notif) => (
                <li
                  key={notif.id}
                  className={`flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:gap-4 ${
                    !notif.is_read ? 'bg-primary/5' : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="flex shrink-0 items-center justify-center sm:pt-1">
                    {!notif.is_read ? (
                      <span className="flex size-2.5 rounded-full bg-primary" />
                    ) : (
                      <span className="flex size-2.5 rounded-full bg-transparent" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <p className="text-base font-medium leading-tight">{notif.title}</p>
                      <div className="flex shrink-0 flex-col items-start sm:items-end">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: id })}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(notif.created_at), 'dd MMM yyyy, HH:mm')}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground">{notif.message}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  )
}
