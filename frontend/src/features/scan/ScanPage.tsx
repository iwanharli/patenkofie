import { Html5Qrcode } from 'html5-qrcode'
import { Camera, CameraOff, CheckCircle2, Keyboard, QrCode, Search } from 'lucide-react'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'

import { AppModal } from '@/components/common/AppModal'
import { PageHeader } from '@/components/common/PageHeader'
import { useToast } from '@/components/feedback/useToast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { fetchOrder, updateOrderStatus, type OrderRecord, type OrderStatus } from '../orders/ordersApi'

export function ScanPage() {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [isCameraActive, setIsCameraActive] = useState(false)
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([])
  const [selectedCameraId, setSelectedCameraId] = useState<string>('')
  const [targetMode, setTargetMode] = useState<'detail' | 'pickup' | 'quick-update'>('detail')
  const [manualCode, setManualCode] = useState('')
  const [scannedCode, setScannedCode] = useState('')

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [quickUpdateOrder, setQuickUpdateOrder] = useState<OrderRecord | null>(null)

  const html5QrcodeRef = useRef<Html5Qrcode | null>(null)
  const scannerContainerId = 'qr-reader-container'

  // Load available cameras
  useEffect(() => {
    Html5Qrcode.getCameras()
      .then((deviceList) => {
        if (deviceList && deviceList.length > 0) {
          setCameras(deviceList)
          // Prefer back camera if available
          const backCamera = deviceList.find(
            (c) => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('rear'),
          )
          setSelectedCameraId(backCamera ? backCamera.id : deviceList[0].id)
        }
      })
      .catch(() => {
        // Camera permission denied or not available
      })
  }, [])

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
        html5QrcodeRef.current.stop().catch(() => {})
      }
    }
  }, [])

  async function startScanner(cameraId?: string) {
    const cameraToUse = cameraId || selectedCameraId
    if (!cameraToUse) {
      toast({
        description: 'Kamera tidak ditemukan. Pastikan izin kamera telah diberikan.',
        title: 'Kamera tidak tersedia',
        variant: 'destructive',
      })
      return
    }

    try {
      if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
        await html5QrcodeRef.current.stop()
      }

      const instance = new Html5Qrcode(scannerContainerId)
      html5QrcodeRef.current = instance

      await instance.start(
        cameraToUse,
        {
          fps: 10,
          qrbox: { height: 250, width: 250 },
        },
        (decodedText) => {
          handleQrDecoded(decodedText)
        },
        () => {
          // ignore scan frame errors
        },
      )

      setIsCameraActive(true)
    } catch {
      toast({
        description: 'Gagal mengakses kamera. Silakan periksa izin browser.',
        title: 'Error Kamera',
        variant: 'destructive',
      })
      setIsCameraActive(false)
    }
  }

  async function stopScanner() {
    if (html5QrcodeRef.current && html5QrcodeRef.current.isScanning) {
      try {
        await html5QrcodeRef.current.stop()
        setIsCameraActive(false)
      } catch {
        // ignore
      }
    }
  }

  function handleQrDecoded(text: string) {
    const code = extractOrderCode(text)
    if (!code) return

    setScannedCode(code)
    void stopScanner()

    if (targetMode === 'quick-update') {
      void handleQuickUpdateFlow(code)
      return
    }

    toast({
      description: `QR ${code} berhasil dibaca. Mengarahkan ke halaman...`,
      title: 'QR Terdeteksi',
      variant: 'success',
    })

    const dest = targetMode === 'pickup' ? `/orders/${code}/pickup` : `/orders/${code}`
    navigate(dest)
  }

  async function handleQuickUpdateFlow(code: string) {
    try {
      const order = await fetchOrder(code)
      if (order.order_status === 'SELESAI' || order.order_status === 'DIBATALKAN') {
        toast({
          title: 'Tidak Dapat Diupdate',
          description: `Pesanan ${code} sudah berstatus ${order.order_status}.`,
          variant: 'destructive',
        })
        void startScanner()
        return
      }
      setQuickUpdateOrder(order)
      setIsUpdateModalOpen(true)
    } catch {
      toast({
        title: 'Error',
        description: `Gagal mengambil data pesanan ${code}.`,
        variant: 'destructive',
      })
      void startScanner()
    }
  }

  async function executeQuickUpdate() {
    if (!quickUpdateOrder) return
    setIsUpdating(true)
    try {
      let nextStatus: OrderStatus = 'DIPROSES'
      if (quickUpdateOrder.order_status === 'DIPROSES') nextStatus = 'SIAP_DIAMBIL'
      else if (quickUpdateOrder.order_status === 'SIAP_DIAMBIL') {
        navigate(`/orders/${quickUpdateOrder.order_code}/pickup`)
        return
      }

      await updateOrderStatus(quickUpdateOrder.order_code, nextStatus, 'Diupdate cepat via Barcode Scanner')
      toast({
        title: 'Status Diperbarui',
        description: `Pesanan ${quickUpdateOrder.order_code} kini berstatus ${nextStatus}.`,
        variant: 'success',
      })
      setIsUpdateModalOpen(false)
      setQuickUpdateOrder(null)
      void startScanner() // resume scanner for next item
    } catch (error) {
      toast({
        title: 'Update Gagal',
        description: error instanceof Error ? error.message : 'Terjadi kesalahan.',
        variant: 'destructive',
      })
    } finally {
      setIsUpdating(false)
    }
  }

  function handleCancelUpdate() {
    setIsUpdateModalOpen(false)
    setQuickUpdateOrder(null)
    void startScanner()
  }

  function handleManualSubmit(e: FormEvent) {
    e.preventDefault()
    const code = extractOrderCode(manualCode)
    if (!code) {
      toast({
        description: 'Masukkan kode pesanan terlebih dahulu.',
        title: 'Kode Kosong',
        variant: 'destructive',
      })
      return
    }

    const dest = targetMode === 'pickup' ? `/orders/${code}/pickup` : `/orders/${code}`
    navigate(dest)
  }

  return (
    <>
      <PageHeader
        description="Scan QR label fisik transaksi kopi menggunakan kamera browser untuk membuka detail atau serah terima order."
        eyebrow="Pengambilan"
        title="Scan QR Order"
      />

      <section className="grid gap-4 xl:grid-cols-[1fr_24rem]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle>Scanner Kamera Live</CardTitle>
            <div className="flex items-center gap-2">
              {isCameraActive ? (
                <Button onClick={() => void stopScanner()} size="sm" variant="outline">
                  <CameraOff className="size-4" />
                  Matikan Kamera
                </Button>
              ) : (
                <Button onClick={() => void startScanner()} size="sm">
                  <Camera className="size-4" />
                  Aktifkan Kamera
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Target Mode Selector */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 rounded-lg bg-muted p-1">
              <button
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
                  targetMode === 'detail'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setTargetMode('detail')}
                type="button"
              >
                Detail Order
              </button>
              <button
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
                  targetMode === 'quick-update'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setTargetMode('quick-update')}
                type="button"
              >
                Update Cepat
              </button>
              <button
                className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all ${
                  targetMode === 'pickup'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                onClick={() => setTargetMode('pickup')}
                type="button"
              >
                Serah Terima
              </button>
            </div>

            {/* Camera Selector dropdown if multiple cameras */}
            {cameras.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Pilih Kamera:</span>
                <select
                  className="rounded-md border border-input bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
                  onChange={(e) => {
                    setSelectedCameraId(e.target.value)
                    if (isCameraActive) {
                      void startScanner(e.target.value)
                    }
                  }}
                  value={selectedCameraId}
                >
                  {cameras.map((cam) => (
                    <option key={cam.id} value={cam.id}>
                      {cam.label || `Kamera ${cam.id}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Video Scanner Element */}
            <div className="relative overflow-hidden rounded-lg border border-dashed border-input bg-muted/60 min-h-[300px] grid place-items-center">
              <div className="w-full" id={scannerContainerId} />

              {!isCameraActive && (
                <div className="py-12 text-center space-y-3">
                  <div className="mx-auto grid size-20 place-items-center rounded-full bg-primary/10 text-primary">
                    <QrCode className="size-10" />
                  </div>
                  <div>
                    <p className="font-semibold">Kamera Belum Aktif</p>
                    <p className="text-xs text-muted-foreground">
                      Klik &quot;Aktifkan Kamera&quot; di atas untuk memulai pemindaian QR code.
                    </p>
                  </div>
                  <Button onClick={() => void startScanner()} size="sm">
                    <Camera className="size-4" />
                    Aktifkan Kamera Sekarang
                  </Button>
                </div>
              )}
            </div>

            {scannedCode && (
              <div className="flex items-center gap-2 rounded-md bg-emerald-500/10 p-3 text-xs font-medium text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <CheckCircle2 className="size-4" />
                <span>QR Terbaca: <strong>{scannedCode}</strong></span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pencarian Manual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-3" onSubmit={handleManualSubmit}>
              <div className="relative">
                <Keyboard className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="Contoh: Paten-GR-260726-0018"
                  value={manualCode}
                />
              </div>
              <Button className="w-full" type="submit">
                <Search aria-hidden="true" className="size-4" />
                Cari Pesanan
              </Button>
            </form>

            <div className="rounded-md bg-muted p-4 text-xs text-muted-foreground space-y-1.5">
              <p className="font-semibold text-foreground">Tips:</p>
              <p>• Posisikan QR label tepat di dalam kotak pembacaan kamera.</p>
              <p>• Jika label fisik rusak, ketik kode transaksi pada kolom pencarian di atas.</p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Quick Update Modal */}
      {quickUpdateOrder && (
        <AppModal
          description="Konfirmasi pembaruan status transaksi ke tahap selanjutnya."
          onOpenChange={(open) => {
            if (!open) handleCancelUpdate()
          }}
          open={isUpdateModalOpen}
          title={`Update Status: ${quickUpdateOrder.order_code}`}
        >
          <div className="space-y-4 pt-2">
            <div className="rounded-md border border-border bg-secondary/50 p-4">
              <p className="text-sm">
                Pelanggan: <span className="font-semibold">{quickUpdateOrder.customer_name}</span>
              </p>
              <p className="text-sm">
                Layanan: <span className="font-semibold">{quickUpdateOrder.service_name} ({quickUpdateOrder.weight_kg} kg)</span>
              </p>
              <div className="mt-3 flex items-center gap-2 text-sm font-medium">
                <span className="text-muted-foreground">{quickUpdateOrder.order_status}</span>
                <span className="text-muted-foreground">→</span>
                <span className="text-primary">
                  {quickUpdateOrder.order_status === 'MENUNGGU'
                    ? 'DIPROSES'
                    : quickUpdateOrder.order_status === 'DIPROSES'
                      ? 'SIAP_DIAMBIL'
                      : 'SERAH_TERIMA (Beralih halaman)'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button disabled={isUpdating} onClick={handleCancelUpdate} variant="outline">
                Batal
              </Button>
              <Button disabled={isUpdating} onClick={() => void executeQuickUpdate()}>
                {isUpdating ? 'Memproses...' : 'Ya, Update Status'}
              </Button>
            </div>
          </div>
        </AppModal>
      )}
    </>
  )
}

function extractOrderCode(text: string): string {
  const trimmed = text.trim()
  if (!trimmed) return ''

  // If scanned text is full URL containing /orders/{code}
  const urlMatch = /\/orders\/([A-Za-z0-9-]+)/.exec(trimmed)
  if (urlMatch && urlMatch[1]) {
    return urlMatch[1]
  }

  return trimmed
}
