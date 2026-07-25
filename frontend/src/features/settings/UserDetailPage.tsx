import { KeyRound, ShieldCheck, UserCog } from 'lucide-react'
import { useParams } from 'react-router'

import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { SettingsTabs } from '@/features/settings/SettingsTabs'
import { users } from '@/features/shared/mockData'

export function UserDetailPage() {
  const params = useParams()
  const user = users.find((item) => item.username === params.username) ?? users[0]

  return (
    <>
      <PageHeader
        actions={<SettingsTabs />}
        description={`@${user.username} · ${user.role}`}
        eyebrow="Detail pengguna"
        title={user.name}
      />

      <section className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Profil akun</CardTitle>
            <Button>
              <UserCog aria-hidden="true" className="size-4" />
              Ubah role
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Info label="Nama" value={user.name} />
            <Info label="Username" value={user.username} />
            <Info label="Role" value={user.role} />
            <Info label="Status" value={user.status} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Akses</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Role</span>
                <Badge variant={user.role === 'OWNER' ? 'default' : 'secondary'}>{user.role}</Badge>
              </div>
              <Separator />
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <ShieldCheck aria-hidden="true" className="size-4 text-primary" />
                <span>Login terakhir: {user.lastLogin}</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <KeyRound aria-hidden="true" className="size-4 text-primary" />
                <span>Password dikelola lewat reset internal.</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Aktivitas terakhir</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm font-medium">{user.activity}</p>
              <p className="mt-1 text-sm text-muted-foreground">{user.lastLogin}</p>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6">{value}</p>
    </div>
  )
}
