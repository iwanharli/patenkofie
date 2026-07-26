import { Activity, Calendar, Camera, KeyRound, ShieldCheck, UserCog, UserRound } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router'

import { AppModal } from '@/components/common/AppModal'
import { PageHeader } from '@/components/common/PageHeader'
import { useToast } from '@/components/feedback/useToast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SettingsTabs } from '@/features/settings/SettingsTabs'
import { UserAuditLogs } from '@/features/settings/UserAuditLogs'
import {
  fetchUser,
  resetUserPassword,
  updateUser,
  uploadAvatar,
  type UserRecord,
} from '@/features/settings/usersApi'
import { useAuth } from '@/features/auth/useAuth'

export function UserDetailPage() {
  const { toast } = useToast()
  const { user: currentUser, checkSession } = useAuth()
  const params = useParams()
  const usernameParam = params.username ?? ''
  const [user, setUser] = useState<UserRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Edit User Modal State
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editRole, setEditRole] = useState<'OWNER' | 'STAFF'>('STAFF')
  const [editIsActive, setEditIsActive] = useState(true)
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)
  const [editError, setEditError] = useState('')

  // Reset Password Modal State
  const [isResetOpen, setIsResetOpen] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [isSubmittingReset, setIsSubmittingReset] = useState(false)
  const [resetError, setResetError] = useState('')

  useEffect(() => {
    if (!usernameParam) {
      setErrorMessage('Username tidak valid.')
      setIsLoading(false)
      return
    }

    let isMounted = true
    setIsLoading(true)

    fetchUser(usernameParam)
      .then((result) => {
        if (isMounted) {
          setUser(result)
          setErrorMessage('')
        }
      })
      .catch(() => {
        if (isMounted) {
          setErrorMessage('Detail pengguna gagal dimuat.')
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
  }, [usernameParam])

  function handleOpenEdit() {
    if (!user) return
    setEditName(user.name)
    setEditRole(user.role)
    setEditIsActive(user.is_active)
    setEditError('')
    setIsEditOpen(true)
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (!editName.trim()) {
      setEditError('Nama pengguna wajib diisi.')
      return
    }

    setIsSubmittingEdit(true)
    setEditError('')

    try {
      const updated = await updateUser(user.username, {
        is_active: editIsActive,
        name: editName.trim(),
        role: editRole,
      })

      setUser(updated)
      toast({
        description: `Akun @${updated.username} berhasil diperbarui.`,
        title: 'Pengguna diperbarui',
        variant: 'success',
      })
      setIsEditOpen(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Gagal memperbarui pengguna.')
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  function handleOpenReset() {
    setNewPassword('')
    setResetError('')
    setIsResetOpen(true)
  }

  async function handleSaveReset(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    if (newPassword.length < 6) {
      setResetError('Password minimal 6 karakter.')
      return
    }

    setIsSubmittingReset(true)
    setResetError('')

    try {
      await resetUserPassword(user.username, newPassword)
      toast({
        description: `Password untuk @${user.username} berhasil direset.`,
        title: 'Password direset',
        variant: 'success',
      })
      setIsResetOpen(false)
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Gagal mereset password.')
    } finally {
      setIsSubmittingReset(false)
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0 || !user) return
    const file = e.target.files[0]

    setIsUploadingAvatar(true)
    try {
      const data = await uploadAvatar(user.username, file)
      setUser((prev) => (prev ? { ...prev, avatar_url: data.avatar_url } : prev))
      toast({
        description: 'Foto profil berhasil diperbarui.',
        title: 'Sukses',
        variant: 'success',
      })
      if (currentUser?.username === user.username) {
        await checkSession()
      }
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : 'Gagal mengunggah foto profil',
        title: 'Error',
        variant: 'destructive',
      })
    } finally {
      setIsUploadingAvatar(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  if (isLoading) {
    return (
      <>
        <PageHeader actions={<SettingsTabs />} eyebrow="Detail pengguna" title="Memuat..." />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Memuat data pengguna dari database...
          </CardContent>
        </Card>
      </>
    )
  }

  if (errorMessage || !user) {
    return (
      <>
        <PageHeader actions={<SettingsTabs />} eyebrow="Detail pengguna" title="Error" />
        <Card>
          <CardContent className="py-12 text-center text-destructive">
            {errorMessage || 'Pengguna tidak ditemukan.'}
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      <section className="grid gap-6 xl:grid-cols-[1fr_22rem]">
        <Card className="overflow-hidden border-none bg-card shadow-sm ring-1 ring-border/50">
          <div className="h-32 w-full bg-gradient-to-r from-primary/90 via-primary/80 to-primary/60" />
          <CardContent className="relative px-6 pb-8 pt-16">
            <div className="absolute -top-12 left-6 grid size-24 place-items-center overflow-hidden rounded-full border-4 border-background bg-gradient-to-br from-primary/10 to-primary/5 text-primary shadow-sm backdrop-blur-md">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt={user.name} className="size-full object-cover" />
              ) : (
                <UserRound aria-hidden="true" className="size-10" />
              )}
              {isUploadingAvatar && (
                <div className="absolute inset-0 grid place-items-center bg-background/50 backdrop-blur-sm">
                  <span className="text-xs font-semibold">...</span>
                </div>
              )}
            </div>

            <Button
              className="absolute left-24 top-6 size-8 rounded-full shadow-sm"
              size="icon"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              title="Ubah Foto Profil"
            >
              <Camera className="size-4" />
            </Button>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/jpeg, image/png, image/webp"
              onChange={handleAvatarChange}
            />

            <div className="absolute right-6 top-4 flex gap-2">
              <Button
                className="bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background"
                onClick={handleOpenReset}
                size="sm"
                variant="outline"
              >
                <KeyRound aria-hidden="true" className="size-4" />
                Reset Password
              </Button>
              <Button className="shadow-sm" onClick={handleOpenEdit} size="sm">
                <UserCog aria-hidden="true" className="size-4" />
                Ubah akun
              </Button>
            </div>

            <div className="mb-8 mt-2">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">{user.name}</h2>
              <p className="font-medium text-muted-foreground">@{user.username}</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border/50 bg-muted/20 p-4 transition-colors hover:bg-muted/40">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role Akses</p>
                <div className="mt-2 flex items-center gap-2">
                  <ShieldCheck aria-hidden="true" className="size-5 text-primary" />
                  <span className="font-medium">{user.role}</span>
                </div>
              </div>
              <div className="rounded-xl border border-border/50 bg-muted/20 p-4 transition-colors hover:bg-muted/40">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status Akun</p>
                <div className="mt-2 flex items-center gap-2">
                  <Activity aria-hidden="true" className="size-5 text-primary" />
                  <Badge variant={user.is_active ? 'success' : 'destructive'}>
                    {user.is_active ? 'Aktif' : 'Nonaktif'}
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none bg-gradient-to-br from-card to-muted/20 shadow-sm ring-1 ring-border/50">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg">Informasi Sistem</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center gap-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Calendar aria-hidden="true" className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">TANGGAL DIBUAT</p>
                  <p className="mt-0.5 truncate text-sm font-semibold">{formatShortDate(user.created_at)}</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <KeyRound aria-hidden="true" className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-muted-foreground">TERAKHIR DIPERBARUI</p>
                  <p className="mt-0.5 truncate text-sm font-semibold">{formatShortDate(user.updated_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <UserAuditLogs username={user.username} />

      {/* Modal Ubah Akun */}
      <AppModal
        description="Ubah nama, role, atau status aktif pengguna ini."
        icon={<UserCog className="size-5" />}
        onOpenChange={setIsEditOpen}
        open={isEditOpen}
        title="Ubah Akun Pengguna"
      >
        <form className="space-y-4 pt-2" onSubmit={(e) => void handleSaveEdit(e)}>
          {editError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {editError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="edit-user-name">Nama Lengkap *</Label>
            <Input
              id="edit-user-name"
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Nama pengguna"
              required
              value={editName}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-user-role">Role *</Label>
            <Select onValueChange={(val) => setEditRole(val as 'OWNER' | 'STAFF')} value={editRole}>
              <SelectTrigger id="edit-user-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STAFF">STAFF (Petugas operasional)</SelectItem>
                <SelectItem value="OWNER">OWNER (Pemilik usaha)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-user-status">Status Akun *</Label>
            <Select
              onValueChange={(val) => setEditIsActive(val === 'true')}
              value={editIsActive ? 'true' : 'false'}
            >
              <SelectTrigger id="edit-user-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Aktif (Dapat login)</SelectItem>
                <SelectItem value="false">Nonaktif (Dilarang login)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button onClick={() => setIsEditOpen(false)} type="button" variant="outline">
              Batal
            </Button>
            <Button disabled={isSubmittingEdit} type="submit">
              {isSubmittingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </div>
        </form>
      </AppModal>

      {/* Modal Reset Password */}
      <AppModal
        description={`Set password baru untuk @${user.username}.`}
        icon={<KeyRound className="size-5" />}
        onOpenChange={setIsResetOpen}
        open={isResetOpen}
        title="Reset Password"
      >
        <form className="space-y-4 pt-2" onSubmit={(e) => void handleSaveReset(e)}>
          {resetError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {resetError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="reset-new-password">Password Baru * (min 6 karakter)</Label>
            <Input
              id="reset-new-password"
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Masukkan password baru"
              required
              type="password"
              value={newPassword}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button onClick={() => setIsResetOpen(false)} type="button" variant="outline">
              Batal
            </Button>
            <Button disabled={isSubmittingReset} type="submit">
              {isSubmittingReset ? 'Mereset...' : 'Simpan Password Baru'}
            </Button>
          </div>
        </form>
      </AppModal>
    </>
  )
}



function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}
