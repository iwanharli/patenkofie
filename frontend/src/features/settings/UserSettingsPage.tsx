import { Plus, ShieldCheck, UserPlus } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Link } from 'react-router'

import { AppModal } from '@/components/common/AppModal'
import { PageHeader } from '@/components/common/PageHeader'
import { PaginationBar } from '@/components/common/PaginationBar'
import { useToast } from '@/components/feedback/useToast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SettingsTabs } from '@/features/settings/SettingsTabs'
import { createUser, fetchUsers, type UserRecord } from '@/features/settings/usersApi'

const PAGE_SIZE = 10

export function UserSettingsPage() {
  const { toast } = useToast()
  const [page, setPage] = useState(1)
  const [users, setUsers] = useState<UserRecord[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  // Create User Modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'OWNER' | 'STAFF'>('STAFF')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)

    fetchUsers(page, PAGE_SIZE)
      .then((result) => {
        if (isMounted) {
          setUsers(result.data)
          setTotalItems(result.meta.total_items)
          setErrorMessage('')
        }
      })
      .catch(() => {
        if (isMounted) {
          setErrorMessage('Daftar pengguna gagal dimuat dari database.')
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false)
        }
      })

    return () => {
      isMounted = false
    }
  }, [page])

  function handleOpenCreate() {
    setName('')
    setUsername('')
    setPassword('')
    setRole('STAFF')
    setCreateError('')
    setIsCreateOpen(true)
  }

  async function handleCreateUser(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !username.trim() || !password) {
      setCreateError('Nama, username, dan password wajib diisi.')
      return
    }
    if (password.length < 6) {
      setCreateError('Password minimal 6 karakter.')
      return
    }

    setIsSubmitting(true)
    setCreateError('')

    try {
      const newUser = await createUser({
        name: name.trim(),
        password,
        role,
        username: username.trim(),
      })

      toast({
        description: `Akun @${newUser.username} (${newUser.role}) berhasil ditambahkan.`,
        title: 'Pengguna ditambahkan',
        variant: 'success',
      })

      setIsCreateOpen(false)
      // Refresh list
      setPage(1)
      const fresh = await fetchUsers(1, PAGE_SIZE)
      setUsers(fresh.data)
      setTotalItems(fresh.meta.total_items)
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Gagal membuat pengguna.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <PageHeader
        actions={<SettingsTabs />}
        description="Manajemen akun pengguna dan role OWNER/STAFF untuk operasional harian."
        eyebrow="Pengaturan"
        title="Pengguna"
      />

      <Card>
        <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>Akun aplikasi</CardTitle>
          <Button onClick={handleOpenCreate}>
            <Plus aria-hidden="true" className="size-4" />
            Tambah pengguna
          </Button>
        </CardHeader>
        {errorMessage && (
          <div className="border-t border-border px-5 py-3 text-sm text-destructive">{errorMessage}</div>
        )}
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {isLoading && (
            <p className="col-span-full py-8 text-muted-foreground">Memuat pengguna dari database...</p>
          )}
          {!isLoading && users.length === 0 && (
            <p className="col-span-full py-8 text-muted-foreground">Belum ada pengguna.</p>
          )}
          {!isLoading &&
            users.map((user) => (
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
                <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <ShieldCheck aria-hidden="true" className={`size-4 ${user.is_active ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span>Status {user.is_active ? 'Aktif' : 'Nonaktif'}</span>
                  </div>
                </div>
              </Link>
            ))}
        </CardContent>
        <PaginationBar
          onPageChange={setPage}
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={totalItems}
        />
      </Card>

      {/* Modal Tambah Pengguna */}
      <AppModal
        description="Buat akun pengguna baru untuk staff atau owner."
        icon={<UserPlus className="size-5" />}
        onOpenChange={setIsCreateOpen}
        open={isCreateOpen}
        title="Tambah Pengguna Baru"
      >
        <form className="space-y-4 pt-2" onSubmit={(e) => void handleCreateUser(e)}>
          {createError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {createError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="create-user-name">Nama Lengkap *</Label>
            <Input
              id="create-user-name"
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Budi Petugas"
              required
              value={name}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-user-username">Username *</Label>
            <Input
              id="create-user-username"
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Contoh: budi.staff"
              required
              value={username}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-user-password">Password * (min 6 karakter)</Label>
            <Input
              id="create-user-password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password pengguna"
              required
              type="password"
              value={password}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="create-user-role">Role *</Label>
            <Select onValueChange={(val) => setRole(val as 'OWNER' | 'STAFF')} value={role}>
              <SelectTrigger id="create-user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STAFF">STAFF (Petugas operasional)</SelectItem>
                <SelectItem value="OWNER">OWNER (Pemilik usaha)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button onClick={() => setIsCreateOpen(false)} type="button" variant="outline">
              Batal
            </Button>
            <Button disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Menyimpan...' : 'Tambah Pengguna'}
            </Button>
          </div>
        </form>
      </AppModal>
    </>
  )
}
