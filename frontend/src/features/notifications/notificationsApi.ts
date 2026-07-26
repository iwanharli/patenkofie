export interface NotificationRecord {
  id: number
  user_id: number
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export async function fetchNotifications(): Promise<NotificationRecord[]> {
  const response = await fetch('/api/v1/notifications', {
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('FAILED_TO_FETCH_NOTIFICATIONS')
  }

  const result = await response.json()
  return result.data || []
}

export async function markAllNotificationsAsRead(): Promise<void> {
  const response = await fetch('/api/v1/notifications/read', {
    method: 'PATCH',
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('FAILED_TO_MARK_NOTIFICATIONS')
  }
}

export async function updateNotificationPreferences(username: string, preferences: Record<string, boolean>): Promise<void> {
  const response = await fetch(`/api/v1/users/${username}/notification-settings`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(preferences),
    credentials: 'include',
  })

  if (!response.ok) {
    throw new Error('FAILED_TO_UPDATE_PREFERENCES')
  }
}
