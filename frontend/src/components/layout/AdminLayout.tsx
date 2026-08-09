import type { PropsWithChildren } from 'react'
import { useEffect, useState } from 'react'

import { MobileSidebar } from '@/components/layout/MobileSidebar'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { fetchBusinessProfile } from '@/features/settings/settingsApi'
import { cn } from '@/lib/utils'

export function AdminLayout({ children }: PropsWithChildren) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [appName, setAppName] = useState('Patenote')

  useEffect(() => {
    fetchBusinessProfile()
      .then(data => {
        if (data.business_name) {
          setAppName(data.business_name)
          document.title = data.business_name
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div className="min-h-svh bg-background text-foreground">
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} appName={appName} />
      <Sidebar
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed((current) => !current)}
        appName={appName}
      />
      <div className={cn('transition-[padding] duration-200 ease-out', isSidebarCollapsed ? 'lg:pl-20' : 'lg:pl-72')}>
        <Topbar
          onOpenMobileSidebar={() => setIsMobileSidebarOpen(true)}
        />
        <main className="flex w-full flex-col gap-5 px-3 py-3 sm:px-4 lg:px-5">{children}</main>
      </div>
    </div>
  )
}
