import { Plus, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/common/PageHeader'
import { PaginationBar } from '@/components/common/PaginationBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SettingsTabs } from '@/features/settings/SettingsTabs'
import { users } from '@/features/shared/mockData'
import { getPaginatedItems } from '@/utils/pagination'

const PAGE_SIZE = 10

export function UserSettingsPage() {
  const [page, setPage] = useState(1)
  const paginatedUsers = getPaginatedItems(users, page, PAGE_SIZE)

  return (
    <>
      <PageHeader
        actions={<SettingsTabs />}
        description="Mock manajemen pengguna dan role OWNER/STAFF untuk operasional harian."
        eyebrow="Pengaturan"
        title="Pengguna"
      />

      <Card>
        <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>Akun aplikasi</CardTitle>
          <Button>
            <Plus aria-hidden="true" className="size-4" />
            Tambah pengguna
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {paginatedUsers.map((user) => (
            <Link
              className="rounded-lg border border-border bg-background p-4 text-foreground transition-colors hover:bg-accent"
              key={user.username}
              to={`/settings/users/${user.username}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{user.name}</p>
                  <p className="text-sm text-muted-foreground">@{user.username}</p>
                </div>
                <Badge variant={user.role === 'OWNER' ? 'default' : 'secondary'}>{user.role}</Badge>
              </div>
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
                <span>Status {user.status}</span>
              </div>
            </Link>
          ))}
        </CardContent>
        <PaginationBar
          onPageChange={setPage}
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={users.length}
        />
      </Card>
    </>
  )
}
