import { Edit, History, Save } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router'

import { useToast } from '@/components/feedback/useToast'
import { PageHeader } from '@/components/common/PageHeader'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { SettingsTabs } from '@/features/settings/SettingsTabs'
import { fetchService, type ServiceRecord } from '@/features/settings/servicesApi'
import { formatRupiah } from '@/utils/format'

export function ServiceDetailPage() {
  const params = useParams()
  const { toast } = useToast()
  const [service, setService] = useState<ServiceRecord | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    let isMounted = true

    if (!params.serviceCode) {
      setErrorMessage('Kode layanan tidak valid.')
      setIsLoading(false)
      return
    }

    fetchService(params.serviceCode)
      .then((data) => {
        if (isMounted) {
          setService(data)
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
  }, [params.serviceCode])

  if (isLoading) {
    return (
      <PageHeader
        actions={<SettingsTabs />}
        description="Memuat data layanan dari database."
        eyebrow="Detail layanan"
        title="Memuat layanan..."
      />
    )
  }

  if (errorMessage || !service) {
    return (
      <>
        <PageHeader
          actions={<SettingsTabs />}
          description="Coba buka kembali halaman daftar layanan."
          eyebrow="Detail layanan"
          title="Layanan tidak tersedia"
        />
        <Card>
          <CardContent className="p-5 text-sm text-destructive">
            {errorMessage || 'Data layanan tidak ditemukan.'}
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        actions={<SettingsTabs />}
        description="Konfigurasi harga layanan aktif dari tabel services."
        eyebrow="Detail layanan"
        title={`${service.code} · ${service.name}`}
      />

      <section className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Konfigurasi harga</CardTitle>
            <Button
              onClick={() => {
                toast({
                  description: 'Komponen toast reusable sudah aktif. Endpoint update harga bisa disambungkan berikutnya.',
                  title: 'Perubahan harga belum disimpan',
                  variant: 'warning',
                })
              }}
            >
              <Save aria-hidden="true" className="size-4" />
              Simpan mock
            </Button>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Kode layanan</Label>
              <Input readOnly value={service.code} />
            </div>
            <div className="space-y-2">
              <Label>Nama layanan</Label>
              <Input readOnly value={service.name} />
            </div>
            <div className="space-y-2">
              <Label>Harga per kg</Label>
              <Input defaultValue={formatRupiah(service.price_per_kg)} />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Input readOnly value={service.is_active ? 'Aktif' : 'Nonaktif'} />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ringkasan hari ini</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Info label="Order" value="Belum dihitung" />
              <Separator />
              <Info label="Volume" value="Belum dihitung" />
              <Separator />
              <Info label="Nilai transaksi" value="Belum dihitung" />
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={service.is_active ? 'success' : 'secondary'}>
                  {service.is_active ? 'Aktif' : 'Nonaktif'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audit harga</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-3">
                <div className="grid size-8 shrink-0 place-items-center rounded-md bg-secondary">
                  <History aria-hidden="true" className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-medium">Harga aktif diverifikasi</p>
                  <p className="text-sm text-muted-foreground">Diubah oleh {service.updated_by}</p>
                </div>
              </div>
              <Button className="w-full" variant="outline">
                <Edit aria-hidden="true" className="size-4" />
                Lihat audit
              </Button>
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
