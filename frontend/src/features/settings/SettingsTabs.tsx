import { Link, useLocation } from 'react-router'

import { Button } from '@/components/ui/button'

const settingsTabs = [
  { label: 'Harga layanan', href: '/settings/services' },
  { label: 'Pengguna', href: '/settings/users' },
] as const

export function SettingsTabs() {
  const location = useLocation()

  return (
    <div className="flex flex-wrap gap-2">
      {settingsTabs.map((tab) => (
        <Button
          asChild
          key={tab.href}
          variant={location.pathname === tab.href ? 'default' : 'outline'}
        >
          <Link to={tab.href}>{tab.label}</Link>
        </Button>
      ))}
    </div>
  )
}
