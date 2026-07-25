import { Keyboard, QrCode, Search } from 'lucide-react'

import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

export function ScanPage() {
  return (
    <>
      <PageHeader
        description="Mockup layar scan QR untuk membuka detail pesanan saat pengambilan."
        eyebrow="Pengambilan"
        title="Scan QR"
      />

      <section className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        <Card>
          <CardContent className="grid min-h-[28rem] place-items-center p-6">
            <div className="text-center">
              <div className="mx-auto grid size-40 place-items-center rounded-lg border border-dashed border-input bg-muted">
                <QrCode aria-hidden="true" className="size-20 text-primary" />
              </div>
              <h2 className="mt-5 text-xl font-semibold">Area kamera scanner</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Preview kamera dan hasil pembacaan QR akan tampil di area ini.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Input manual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Keyboard className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Paten-GR-260726-0018" />
            </div>
            <Button className="w-full">
              <Search aria-hidden="true" className="size-4" />
              Cari pesanan
            </Button>
            <div className="rounded-md bg-muted p-4 text-sm text-muted-foreground">
              Gunakan input manual jika kamera tidak tersedia atau label sulit dipindai.
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  )
}
