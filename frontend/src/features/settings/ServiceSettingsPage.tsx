import { Edit, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { AppModal } from '@/components/common/AppModal'
import { useToast } from '@/components/feedback/useToast'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DialogClose } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SettingsTabs } from '@/features/settings/SettingsTabs'
import { fetchServices, type ServiceRecord } from '@/features/settings/servicesApi'
import { formatRupiah } from '@/utils/format'

export function ServiceSettingsPage() {
  const { toast } = useToast()
  const [services, setServices] = useState<ServiceRecord[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    fetchServices()
      .then((data) => {
        if (isMounted) {
          setServices(data)
          setErrorMessage('')
        }
      })
      .catch(() => {
        if (isMounted) {
          setErrorMessage('Data layanan gagal dimuat dari database.')
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

  return (
    <>
      <PageHeader
        actions={<SettingsTabs />}
        description="Data harga layanan aktif dari database PostgreSQL."
        eyebrow="Pengaturan"
        title="Harga layanan"
      />

      <Card>
        <CardHeader className="gap-3 md:flex-row md:items-center md:justify-between">
          <CardTitle>Layanan aktif</CardTitle>
          <AppModal
            description="Penambahan layanan baru dibatasi oleh constraint database (hanya mendukung G, R, dan GR saat ini)."
            footer={
              <>
                <DialogClose asChild>
                  <Button variant="outline">Batal</Button>
                </DialogClose>
                <DialogClose asChild>
                  <Button
                    onClick={() => {
                      toast({
                        description: 'Silakan hubungi administrator untuk menambahkan kode layanan baru ke database.',
                        title: 'Dibatasi oleh sistem',
                        variant: 'warning',
                      })
                    }}
                  >
                    Simpan
                  </Button>
                </DialogClose>
              </>
            }
            icon={<Plus aria-hidden="true" className="size-5" />}
            title="Tambah layanan"
            trigger={
              <Button>
                <Plus aria-hidden="true" className="size-4" />
                Tambah layanan
              </Button>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Kode layanan</Label>
                <Input placeholder="Contoh: C" />
              </div>
              <div className="space-y-2">
                <Label>Harga per kg</Label>
                <Input placeholder="Rp0" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Nama layanan</Label>
                <Input placeholder="Nama layanan baru" />
              </div>
            </div>
          </AppModal>
        </CardHeader>
        {errorMessage && (
          <div className="border-t border-border px-5 py-3 text-sm text-destructive">{errorMessage}</div>
        )}
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-border bg-muted/70 text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="px-5 py-3">Kode</th>
                <th className="px-5 py-3">Nama</th>
                <th className="px-5 py-3">Harga/kg</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Diubah oleh</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="px-5 py-6 text-muted-foreground" colSpan={6}>
                    Memuat data layanan...
                  </td>
                </tr>
              )}
              {!isLoading && services.map((service) => (
                <tr className="border-b border-border last:border-b-0" key={service.code}>
                  <td className="px-5 py-4 font-semibold">{service.code}</td>
                  <td className="px-5 py-4">{service.name}</td>
                  <td className="px-5 py-4 font-semibold">{formatRupiah(service.price_per_kg)}</td>
                  <td className="px-5 py-4">
                    <Badge variant={service.is_active ? 'success' : 'secondary'}>
                      {service.is_active ? 'Aktif' : 'Nonaktif'}
                    </Badge>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">{service.updated_by}</td>
                  <td className="px-5 py-4 text-right">
                    <Button asChild size="sm" variant="outline">
                      <Link to={`/settings/services/${service.code}`}>
                        <Edit aria-hidden="true" className="size-4" />
                        Detail
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </>
  )
}
