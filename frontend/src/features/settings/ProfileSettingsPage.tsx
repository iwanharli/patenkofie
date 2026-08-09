import { Database, Download, Building2, Save, Image, Upload, Bell } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'

import { PageHeader } from '@/components/common/PageHeader'
import { useToast } from '@/components/feedback/useToast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/features/auth/useAuth'
import {
  fetchBusinessProfile,
  getDatabaseBackupUrl,
  updateBusinessProfile,
  uploadLogo,
} from '@/features/settings/settingsApi'
import { updateNotificationPreferences } from '@/features/notifications/notificationsApi'
import { SettingsTabs } from '@/features/settings/SettingsTabs'

export function ProfileSettingsPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [businessName, setBusinessName] = useState('')
  const [businessAddress, setBusinessAddress] = useState('')
  const [businessPhone, setBusinessPhone] = useState('')
  const [receiptFooter, setReceiptFooter] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isUploadingLogo, setIsUploadingLogo] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const [notificationPrefs, setNotificationPrefs] = useState<Record<string, boolean>>({
    security: true,
    order_updates: true,
    daily_report: true,
  })
  const [isSavingPrefs, setIsSavingPrefs] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const isOwner = user?.role === 'OWNER'

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)

    fetchBusinessProfile()
      .then((profile) => {
        if (isMounted) {
          setBusinessName(profile.business_name)
          setBusinessAddress(profile.business_address)
          setBusinessPhone(profile.business_phone)
          setReceiptFooter(profile.receipt_footer)
          setLogoUrl(profile.logo_url || '')
          setErrorMessage('')
          
          if (user?.notification_preferences) {
            setNotificationPrefs(user.notification_preferences as Record<string, boolean>)
          }
        }
      })
      .catch((error) => {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : 'Gagal memuat profil toko.')
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
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!businessName.trim()) {
      toast({
        description: 'Nama toko wajib diisi.',
        title: 'Input Tidak Valid',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    try {
      const updated = await updateBusinessProfile({
        business_address: businessAddress,
        business_name: businessName,
        business_phone: businessPhone,
        receipt_footer: receiptFooter,
      })
      setBusinessName(updated.business_name)
      setBusinessAddress(updated.business_address)
      setBusinessPhone(updated.business_phone)
      setReceiptFooter(updated.receipt_footer)

      toast({
        description: 'Profil toko dan catatan nota berhasil diperbarui.',
        title: 'Profil Diperbarui',
        variant: 'success',
      })
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : 'Gagal memperbarui profil toko.',
        title: 'Update Gagal',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return
    const file = e.target.files[0]

    setIsUploadingLogo(true)
    try {
      const data = await uploadLogo(file)
      setLogoUrl(data.logo_url)
      toast({
        description: data.message,
        title: 'Sukses',
        variant: 'success',
      })
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : 'Gagal mengunggah logo',
        title: 'Error',
        variant: 'destructive',
      })
    } finally {
      setIsUploadingLogo(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  function handleDownloadBackup() {
    window.location.href = getDatabaseBackupUrl()
  }

  async function handleToggleNotification(key: string, checked: boolean) {
    if (!user) return
    const newPrefs = { ...notificationPrefs, [key]: checked }
    setNotificationPrefs(newPrefs)
    setIsSavingPrefs(true)
    try {
      await updateNotificationPreferences(user.username, newPrefs)
      toast({ title: 'Preferensi disimpan', description: 'Pengaturan notifikasi berhasil diperbarui.' })
    } catch (error) {
      setNotificationPrefs(notificationPrefs) // revert
      toast({
        title: 'Error',
        description: 'Gagal memperbarui pengaturan notifikasi.',
        variant: 'destructive',
      })
    } finally {
      setIsSavingPrefs(false)
    }
  }

  return (
    <>
      <PageHeader
        actions={<SettingsTabs />}
        description="Kelola nama toko, alamat, kontak nota cetak, dan backup cadangan database."
        eyebrow="Pengaturan"
        title="Profil Toko & Backup"
      />

      <section className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        {/* Kolom Kiri */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="grid size-10 place-items-center rounded-md bg-secondary text-primary">
                <Building2 className="size-5" />
              </div>
              <div>
                <CardTitle>Identitas Toko & Custom Nota</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Informasi ini akan tercetak otomatis pada header label QR dan bukti nota pembayaran.
                </p>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading && (
                <p className="py-12 text-center text-sm text-muted-foreground">Memuat profil toko...</p>
              )}

              {errorMessage && (
                <p className="py-12 text-center text-sm text-destructive">{errorMessage}</p>
              )}

              {!isLoading && !errorMessage && (
                <form className="space-y-4" onSubmit={handleSubmit}>
                  <div className="space-y-1.5">
                    <Label htmlFor="business-name">Nama Toko Kopi</Label>
                    <Input
                      disabled={!isOwner}
                      id="business-name"
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Contoh: Patenote Coffee"
                      value={businessName}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="business-phone">No. Telepon / WhatsApp Toko</Label>
                    <Input
                      disabled={!isOwner}
                      id="business-phone"
                      onChange={(e) => setBusinessPhone(e.target.value)}
                      placeholder="Contoh: 0812-3456-7890"
                      value={businessPhone}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="business-address">Alamat Toko</Label>
                    <textarea
                      className="w-full rounded-md border border-input bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[70px]"
                      disabled={!isOwner}
                      id="business-address"
                      onChange={(e) => setBusinessAddress(e.target.value)}
                      placeholder="Contoh: Jl. Raya Kopi No. 123, Malang"
                      value={businessAddress}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="receipt-footer">Catatan Kaki Nota (Receipt Footer)</Label>
                    <textarea
                      className="w-full rounded-md border border-input bg-background p-2.5 text-sm outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50 min-h-[70px]"
                      disabled={!isOwner}
                      id="receipt-footer"
                      onChange={(e) => setReceiptFooter(e.target.value)}
                      placeholder="Contoh: Terima kasih atas kunjungan Anda. Harap simpan label QR ini."
                      value={receiptFooter}
                    />
                  </div>

                  {isOwner ? (
                    <div className="pt-2 flex justify-end">
                      <Button disabled={isSaving} type="submit">
                        <Save className="size-4" />
                        {isSaving ? 'Menyimpan...' : 'Simpan Profil Toko'}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Hanya OWNER yang dapat mengubah profil toko.
                    </p>
                  )}
                </form>
              )}
            </CardContent>
          </Card>

          {/* Card Notifikasi */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="grid size-10 place-items-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Bell className="size-5" />
              </div>
              <div>
                <CardTitle>Pengaturan Notifikasi</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Pilih jenis pemberitahuan yang ingin Anda terima.</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="notif-security" className="text-sm font-medium">Peringatan Keamanan</Label>
                  <p className="text-xs text-muted-foreground">Log masuk baru, percobaan gagal, atau aktivitas mencurigakan.</p>
                </div>
                <Switch
                  id="notif-security"
                  checked={notificationPrefs.security}
                  onCheckedChange={(c) => handleToggleNotification('security', c)}
                  disabled={isSavingPrefs}
                />
              </div>
              
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-0.5">
                  <Label htmlFor="notif-order" className="text-sm font-medium">Pembaruan Transaksi</Label>
                  <p className="text-xs text-muted-foreground">Pesanan baru, pembatalan, dan pesanan siap diambil.</p>
                </div>
                <Switch
                  id="notif-order"
                  checked={notificationPrefs.order_updates}
                  onCheckedChange={(c) => handleToggleNotification('order_updates', c)}
                  disabled={isSavingPrefs}
                />
              </div>

              {isOwner && (
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label htmlFor="notif-report" className="text-sm font-medium">Laporan Harian</Label>
                    <p className="text-xs text-muted-foreground">Ringkasan transaksi dan aktivitas harian sistem.</p>
                  </div>
                  <Switch
                    id="notif-report"
                    checked={notificationPrefs.daily_report}
                    onCheckedChange={(c) => handleToggleNotification('daily_report', c)}
                    disabled={isSavingPrefs}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Kolom Kanan */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
                <Image className="size-5" />
              </div>
              <div>
                <CardTitle>Logo Toko</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Digunakan pada nota.</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-center">
                <div className="relative flex h-24 w-full max-w-[200px] items-center justify-center overflow-hidden rounded-md border-2 border-dashed border-border/50 bg-muted/20">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo Toko" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-xs font-medium text-muted-foreground">Belum ada logo</span>
                  )}
                  {isUploadingLogo && (
                    <div className="absolute inset-0 grid place-items-center bg-background/50 backdrop-blur-sm">
                      <span className="text-xs font-semibold">Memproses...</span>
                    </div>
                  )}
                </div>
              </div>
              {isOwner ? (
                <>
                  <Button className="w-full" onClick={() => fileInputRef.current?.click()} variant="outline" disabled={isUploadingLogo}>
                    <Upload className="size-4" />
                    {isUploadingLogo ? 'Mengunggah...' : 'Unggah Logo Baru'}
                  </Button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept="image/jpeg, image/png, image/webp"
                    onChange={handleLogoChange}
                  />
                </>
              ) : (
                <p className="text-center text-xs text-amber-600 dark:text-amber-400">
                  Hanya OWNER yang dapat mengubah logo.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Card Backup Database */}
          <Card>
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="grid size-10 place-items-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Database className="size-5" />
              </div>
              <div>
                <CardTitle>Backup Database (1-Klik)</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Unduh cadangan data lengkap dalam format SQL.</p>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs leading-5 text-muted-foreground">
                Berkas cadangan memuat seluruh data transaksi, pelanggan, pembayaran, harga layanan, dan log aktivitas audit.
              </p>
              {isOwner ? (
                <Button className="w-full" onClick={handleDownloadBackup} variant="outline">
                  <Download className="size-4" />
                  Unduh Backup (.sql)
                </Button>
              ) : (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Hanya OWNER yang dapat mengunduh backup database.
                </p>
              )}
            </CardContent>
          </Card>

        </div>
      </section>
    </>
  )
}
