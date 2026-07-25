import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  FileCheck2,
  ImageIcon,
  Save,
  Upload,
  UserCheck,
  X,
} from 'lucide-react'
import type { ChangeEvent, FormEvent, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { PageHeader } from '@/components/common/PageHeader'
import { useToast } from '@/components/feedback/useToast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { fetchOrder, type OrderRecord } from '@/features/orders/ordersApi'
import { createPickup, fetchPickup, type PickupRecord } from '@/features/orders/pickupsApi'
import { OrderStatusBadge, PaymentStatusBadge } from '@/features/orders/status'
import { cn } from '@/lib/utils'
import { formatEnumLabel } from '@/utils/format'

export function PickupDetailPage() {
  const params = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [pickup, setPickup] = useState<PickupRecord | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(params.orderCode))
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [recipientName, setRecipientName] = useState('')
  const [recipientType, setRecipientType] = useState<'CUSTOMER' | 'REPRESENTATIVE'>('CUSTOMER')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState('')
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    let isMounted = true

    if (!params.orderCode) {
      setIsLoading(false)
      return
    }

    Promise.all([
      fetchOrder(params.orderCode),
      fetchPickup(params.orderCode).catch(() => null),
    ])
      .then(([orderData, pickupData]) => {
        if (!isMounted) {
          return
        }

        setOrder(orderData)
        setPickup(pickupData)
        setRecipientName(pickupData?.recipient_name ?? orderData.customer_name)
        setRecipientPhone(pickupData?.recipient_phone ?? orderData.customer_phone ?? '')
        setRecipientType(pickupData?.recipient_type ?? 'CUSTOMER')
        setNotes(pickupData?.notes ?? '')
      })
      .catch(() => {
        if (isMounted) {
          setOrder(null)
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
  }, [params.orderCode])

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview('')
      return
    }

    const objectUrl = URL.createObjectURL(photoFile)
    setPhotoPreview(objectUrl)

    return () => URL.revokeObjectURL(objectUrl)
  }, [photoFile])

  useEffect(() => {
    const video = videoRef.current
    if (video) {
      video.srcObject = cameraStream
    }
  }, [cameraStream])

  useEffect(() => {
    if (!cameraStream) {
      return
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [cameraStream])

  useEffect(() => {
    return () => {
      stopCameraStream(cameraStream)
    }
  }, [cameraStream])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    if (!order) {
      return
    }
    if (!recipientName.trim()) {
      setErrorMessage('Nama pengambil wajib diisi.')
      return
    }
    if (!photoFile) {
      setErrorMessage('Foto bukti pengambilan wajib diambil atau diunggah.')
      return
    }

    const formData = new FormData()
    formData.set('recipient_name', recipientName)
    formData.set('recipient_type', recipientType)
    formData.set('recipient_phone', recipientPhone)
    formData.set('notes', notes)
    formData.set('photo', photoFile)

    setIsSubmitting(true)
    try {
      const savedPickup = await createPickup(order.order_code, formData)
      const updatedOrder = await fetchOrder(order.order_code)
      setPickup(savedPickup)
      setOrder(updatedOrder)
      stopCamera()
      toast({
        description: `${order.order_code} selesai dengan bukti foto.`,
        title: 'Serah terima disimpan',
        variant: 'success',
      })
      navigate(`/orders/${order.order_code}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Bukti pengambilan gagal disimpan.'
      setErrorMessage(message)
      toast({
        description: message,
        title: 'Serah terima gagal',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    setPhotoFile(event.target.files?.[0] ?? null)
    setCameraError('')
    stopCamera()
  }

  async function openCamera() {
    setCameraError('')

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Kamera langsung tidak tersedia di browser ini. Gunakan unggah file.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          height: { ideal: 1200 },
          width: { ideal: 1600 },
        },
      })
      stopCameraStream(cameraStream)
      setCameraStream(stream)
    } catch {
      setCameraError('Akses kamera ditolak atau kamera tidak tersedia. Gunakan unggah file.')
    }
  }

  function stopCamera() {
    stopCameraStream(cameraStream)
    setCameraStream(null)
  }

  async function capturePhoto() {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) {
      setCameraError('Kamera belum siap. Tunggu sebentar lalu coba lagi.')
      return
    }

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const context = canvas.getContext('2d')
    if (!context) {
      setCameraError('Foto gagal diambil. Coba ulangi.')
      return
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9))
    if (!blob) {
      setCameraError('Foto gagal diproses. Coba ulangi.')
      return
    }

    setPhotoFile(new File([blob], `pickup-${order?.order_code ?? 'photo'}.jpg`, { type: 'image/jpeg' }))
    setCameraError('')
    stopCamera()
  }

  if (isLoading) {
    return (
      <PageHeader
        description="Memuat transaksi dan bukti pengambilan."
        eyebrow="Serah terima"
        title="Memuat..."
      />
    )
  }

  if (!order) {
    return (
      <>
        <PageHeader
          actions={
            <Button asChild variant="outline">
              <Link to="/orders">
                <ArrowLeft aria-hidden="true" className="size-4" />
                Kembali
              </Link>
            </Button>
          }
          description="Kode transaksi tidak ditemukan di database."
          eyebrow="Serah terima"
          title="Transaksi tidak ditemukan"
        />
      </>
    )
  }

  const displayPhoto = pickup?.photo_path ?? photoPreview
  const hasPickup = Boolean(pickup)
  const primaryActionLabel = hasPickup ? 'Bukti sudah tersimpan' : isSubmitting ? 'Menyimpan...' : 'Simpan dan selesaikan'

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {cameraStream && (
        <div className="fixed inset-0 z-[100] bg-black text-white">
          <video
            ref={videoRef}
            autoPlay
            className="absolute inset-0 h-full w-full object-cover"
            muted
            playsInline
          />

          <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent px-4 pb-16 pt-4 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{order.order_code}</p>
                <p className="mt-0.5 truncate text-xs text-white/70">Foto bukti pengambilan</p>
              </div>
              <button
                aria-label="Tutup kamera"
                className="pointer-events-auto grid size-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
                onClick={stopCamera}
                type="button"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
          </div>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-4 pb-8 pt-24">
            <button
              aria-label="Ambil foto"
              className="pointer-events-auto grid size-20 place-items-center rounded-full border-4 border-white/90 bg-white/20 shadow-2xl backdrop-blur transition active:scale-95"
              onClick={capturePhoto}
              type="button"
            >
              <span className="block size-14 rounded-full bg-white" />
            </button>
            <p className="text-xs font-medium text-white/75">Ketuk tombol untuk mengambil foto</p>
          </div>
        </div>
      )}

      <PageHeader
        actions={
          <Button asChild variant="outline">
            <Link to={`/orders/${order.order_code}`}>
              <ArrowLeft aria-hidden="true" className="size-4" />
              Kembali
            </Link>
          </Button>
        }
        description={`${order.customer_name} - ${order.service_name} - ${formatWeight(order.weight_kg)} kg`}
        eyebrow="Serah terima"
        title={order.order_code}
      />

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="overflow-hidden">
          <CardContent className="grid gap-0 p-0 lg:grid-cols-[minmax(24rem,0.86fr)_1fr]">
            <div className="border-b border-border bg-muted/40 p-4 lg:border-b-0 lg:border-r">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {hasPickup ? 'Foto bukti tersimpan' : photoFile ? 'Foto siap disimpan' : 'Ambil foto pengambilan'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Bukti visual wajib sebelum order menjadi selesai.
                  </p>
                </div>
                {photoFile && !hasPickup && <Badge variant="secondary">SIAP</Badge>}
                {hasPickup && <Badge variant="secondary">TERSIMPAN</Badge>}
              </div>

              <div className="grid aspect-[4/3] place-items-center overflow-hidden rounded-md border border-dashed border-input bg-background">
                {displayPhoto ? (
                  <img alt="Bukti pengambilan" className="h-full w-full object-cover" src={displayPhoto} />
                ) : (
                  <div className="px-6 text-center">
                    <div className="mx-auto grid size-14 place-items-center rounded-md bg-secondary text-secondary-foreground">
                      <ImageIcon aria-hidden="true" className="size-7" />
                    </div>
                    <p className="mt-3 text-sm font-semibold">Belum ada foto</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Ambil foto penerima, nota, atau bukti serah terima yang jelas.
                    </p>
                  </div>
                )}
              </div>

              {!hasPickup && (
                <div className="mt-3 space-y-3">
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button onClick={openCamera} type="button">
                      <Camera aria-hidden="true" className="size-4" />
                      Buka kamera
                    </Button>
                    <Button onClick={() => fileInputRef.current?.click()} type="button" variant="outline">
                      <Upload aria-hidden="true" className="size-4" />
                      Unggah file
                    </Button>
                  </div>

                  {photoFile && (
                    <div className="flex items-center justify-between gap-3 rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{photoFile.name}</p>
                        <p className="text-muted-foreground">{formatFileSize(photoFile.size)}</p>
                      </div>
                      <Button onClick={() => setPhotoFile(null)} size="sm" type="button" variant="outline">
                        Ganti
                      </Button>
                    </div>
                  )}

                  <input
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    id="pickup-photo"
                    onChange={handlePhotoChange}
                    ref={fileInputRef}
                    type="file"
                  />
                  {cameraError && <p className="text-xs font-medium text-destructive">{cameraError}</p>}
                  <p className="text-xs leading-5 text-muted-foreground">
                    Kamera butuh izin browser. File JPG, PNG, atau WebP akan dikompres otomatis saat disimpan.
                  </p>
                </div>
              )}
            </div>

            <div className="grid content-start gap-4 p-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <p className="text-sm font-semibold">Data pengambil</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pastikan nama dan nomor pengambil sesuai saat barang diserahkan.
                </p>
              </div>
              <Field label="Nama pengambil" required>
                <Input
                  disabled={hasPickup}
                  onChange={(event) => setRecipientName(event.target.value)}
                  value={recipientName}
                />
              </Field>
              <Field label="Tipe pengambil">
                <Select
                  disabled={hasPickup}
                  onValueChange={(value) => setRecipientType(value as 'CUSTOMER' | 'REPRESENTATIVE')}
                  value={recipientType}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CUSTOMER">Pelanggan sendiri</SelectItem>
                    <SelectItem value="REPRESENTATIVE">Perwakilan</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Telepon pengambil">
                <Input
                  disabled={hasPickup}
                  inputMode="tel"
                  onChange={(event) => setRecipientPhone(event.target.value)}
                  value={recipientPhone}
                />
              </Field>
              <Info label="Diserahkan oleh" value={pickup?.handed_over_name ?? '-'} />
              <Info label="Waktu pengambilan" value={pickup ? formatDate(pickup.picked_up_at) : '-'} />
              <Info label="Status order" value={formatEnumLabel(order.order_status)} />
              <div className="space-y-2 sm:col-span-2">
                <Label>Catatan</Label>
                <textarea
                  className="min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={hasPickup}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Catatan serah terima"
                  value={notes}
                />
              </div>
              {errorMessage && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive sm:col-span-2">
                  {errorMessage}
                </div>
              )}
              {!hasPickup && (
                <Button className="mt-1 h-11 sm:col-span-2" disabled={isSubmitting} type="submit">
                  <Save aria-hidden="true" className="size-4" />
                  {primaryActionLabel}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck2 aria-hidden="true" className="size-5 text-primary" />
                Validasi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <StatusLine label="Pembayaran">
                <PaymentStatusBadge status={order.payment_status} />
              </StatusLine>
              <StatusLine label="Order">
                <OrderStatusBadge status={order.order_status} />
              </StatusLine>
              <StatusLine label="Foto">
                <Badge
                  className={cn(hasPickup || photoFile ? 'bg-primary text-primary-foreground' : '')}
                  variant="secondary"
                >
                  {hasPickup ? 'Tersimpan' : photoFile ? 'Siap' : 'Wajib'}
                </Badge>
              </StatusLine>
              <Separator />
              <div className="flex items-start gap-3 rounded-md bg-muted/60 p-3 text-sm text-muted-foreground">
                <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 text-primary" />
                <span>Order selesai hanya disimpan setelah foto bukti tersedia.</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Petugas</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-md bg-secondary text-secondary-foreground">
                <UserCheck aria-hidden="true" className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold">{pickup?.handed_over_name ?? 'Petugas aktif'}</p>
                <Badge variant="secondary">{hasPickup ? 'TERSIMPAN' : 'SIAP INPUT'}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </form>
  )
}

function Field({
  children,
  label,
  required,
}: {
  children: ReactNode
  label: string
  required?: boolean
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/50 px-3 py-2">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-6">{value}</p>
    </div>
  )
}

function StatusLine({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatWeight(value: string) {
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(Number(value))
}

function formatFileSize(value: number) {
  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`
  }

  return `${(value / 1024 / 1024).toLocaleString('id-ID', {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  })} MB`
}

function stopCameraStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop())
}
