import {
  ArrowLeft,
  Banknote,
  Camera,
  CheckCircle2,
  ImageIcon,
  PackageCheck,
  Printer,
  QrCode,
  Save,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { AppModal } from '@/components/common/AppModal'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { PageHeader } from '@/components/common/PageHeader'
import { useToast } from '@/components/feedback/useToast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/features/auth/useAuth'
import {
  deleteOrder,
  fetchOrder,
  type OrderRecord,
  type OrderStatus,
  updateOrderStatus,
} from '@/features/orders/ordersApi'
import { fetchPickup, type PickupRecord } from '@/features/orders/pickupsApi'
import { OrderStatusBadge, PaymentStatusBadge } from '@/features/orders/status'
import { settleOrderPayment } from '@/features/payments/paymentsApi'
import { formatEnumLabel, formatRupiah } from '@/utils/format'

const statusOptions: Array<{ description: string; label: string; value: OrderStatus }> = [
  { description: 'Transaksi baru diterima.', label: 'Menunggu', value: 'MENUNGGU' },
  { description: 'Kopi sedang dikerjakan.', label: 'Diproses', value: 'DIPROSES' },
  { description: 'Pesanan sudah siap diambil.', label: 'Siap diambil', value: 'SIAP_DIAMBIL' },
  { description: 'Pesanan sudah diserahkan.', label: 'Selesai', value: 'SELESAI' },
  { description: 'Transaksi dibatalkan.', label: 'Dibatalkan', value: 'DIBATALKAN' },
]

const progressStatuses: OrderStatus[] = ['MENUNGGU', 'DIPROSES', 'SIAP_DIAMBIL', 'SELESAI']

export function OrderDetailPage() {
  const params = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [pickup, setPickup] = useState<PickupRecord | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(params.orderCode))
  const [isUpdating, setIsUpdating] = useState(false)
  const [isSettlingPayment, setIsSettlingPayment] = useState(false)
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false)
  const [settleNotes, setSettleNotes] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>('MENUNGGU')
  const [statusNotes, setStatusNotes] = useState('')
  const canDelete = user?.role === 'OWNER' && Boolean(order)
  const isCompleted = order?.order_status === 'SELESAI'
  const selectedStatusMeta = useMemo(
    () => statusOptions.find((item) => item.value === selectedStatus),
    [selectedStatus],
  )

  useEffect(() => {
    let isMounted = true

    if (!params.orderCode) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    Promise.all([
      fetchOrder(params.orderCode),
      fetchPickup(params.orderCode).catch(() => null),
    ])
      .then(([item, pickupData]) => {
        if (isMounted) {
          setOrder(item)
          setPickup(pickupData)
          setSelectedStatus(item.order_status)
        }
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

  async function handleDelete() {
    if (!order) {
      return
    }

    try {
      await deleteOrder(order.order_code)
      toast({
        description: `${order.order_code} berhasil dihapus dari database.`,
        title: 'Transaksi dihapus',
        variant: 'success',
      })
      navigate('/orders')
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : 'Transaksi gagal dihapus.',
        title: 'Hapus transaksi gagal',
        variant: 'destructive',
      })
    }
  }

  async function handleUpdateStatus() {
    if (!order || selectedStatus === order.order_status) {
      return
    }
    if (selectedStatus === 'SELESAI') {
      toast({
        description: 'Lengkapi serah terima dan foto bukti pengambilan terlebih dahulu.',
        title: 'Foto pengambilan wajib',
        variant: 'warning',
      })
      navigate(`/orders/${order.order_code}/pickup`)
      return
    }

    setIsUpdating(true)
    try {
      const updated = await updateOrderStatus(order.order_code, selectedStatus, statusNotes)
      setOrder(updated)
      setSelectedStatus(updated.order_status)
      setStatusNotes('')
      toast({
        description: `Status ${updated.order_code} sekarang ${formatEnumLabel(updated.order_status)}.`,
        title: 'Status diperbarui',
        variant: 'success',
      })
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : 'Status transaksi gagal diperbarui.',
        title: 'Update status gagal',
        variant: 'destructive',
      })
    } finally {
      setIsUpdating(false)
    }
  }

  async function handleSettlePayment() {
    if (!order) {
      return
    }

    setIsSettlingPayment(true)
    try {
      const payment = await settleOrderPayment(order.order_code, settleNotes)
      const updatedOrder = await fetchOrder(order.order_code)
      setOrder(updatedOrder)
      setSettleNotes('')
      setIsSettleModalOpen(false)
      toast({
        action: {
          label: 'Lihat bukti',
          onClick: () => navigate(`/payments/${payment.payment_code}`),
        },
        description: `${payment.payment_code} senilai ${formatRupiah(payment.amount)} tersimpan.`,
        title: 'Pelunasan disimpan',
        variant: 'success',
      })
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : 'Pelunasan gagal disimpan.',
        title: 'Pelunasan gagal',
        variant: 'destructive',
      })
    } finally {
      setIsSettlingPayment(false)
    }
  }

  if (isLoading) {
    return (
      <PageHeader
        description="Memuat detail transaksi dari database."
        eyebrow="Detail transaksi"
        title="Memuat transaksi..."
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
          description="Kode transaksi ini tidak ditemukan di database."
          eyebrow="Detail transaksi"
          title="Transaksi tidak ditemukan"
        />
        <Card>
          <CardContent className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <PackageCheck aria-hidden="true" className="mx-auto size-12 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Tidak ada data transaksi untuk ditampilkan.</p>
            </div>
          </CardContent>
        </Card>
      </>
    )
  }

  const canUpdateStatus = selectedStatus !== order.order_status && !isUpdating
  const canSettlePayment = order.remaining > 0

  return (
    <>
      <PageHeader
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/orders">
                <ArrowLeft aria-hidden="true" className="size-4" />
                Kembali
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link target="_blank" to={`/print/orders/${order.order_code}/label`}>
                <Printer aria-hidden="true" className="size-4" />
                Cetak label
              </Link>
            </Button>
            {canDelete && (
              <ConfirmModal
                confirmLabel="Hapus"
                description="Transaksi, pembayaran, status log, dan data serah terima terkait akan dihapus dari database."
                onConfirm={() => void handleDelete()}
                title={`Hapus ${order.order_code}?`}
                trigger={
                  <Button variant="destructive">
                    <Trash2 aria-hidden="true" className="size-4" />
                    Hapus
                  </Button>
                }
                variant="destructive"
              />
            )}
          </>
        }
        description={`${order.customer_name} - ${order.service_name} - ${formatWeight(order.weight_kg)} kg`}
        eyebrow="Detail transaksi"
        title={order.order_code}
      />

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <PanelIcon icon={UserRound} />
                <div>
                  <CardTitle>Informasi pelanggan</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Identitas pemilik kopi dan catatan transaksi.</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <OrderStatusBadge status={order.order_status} />
                <PaymentStatusBadge status={order.payment_status} />
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Nama pelanggan" value={order.customer_name} />
              <Info label="Telepon" value={order.customer_phone ?? '-'} />
              <Info label="Kode transaksi" value={order.order_code} />
              <Info label="Tanggal masuk" value={formatDate(order.created_at)} />
              <Info label="Terakhir diubah" value={formatDate(order.updated_at)} />
              <Info label="Catatan" value={order.notes ?? '-'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <PanelIcon icon={PackageCheck} />
                <div>
                  <CardTitle>Detail layanan</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Rincian pekerjaan dan perhitungan harga.</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Layanan" value={`${order.service_code} - ${order.service_name}`} />
              <Info label="Berat masuk" value={`${formatWeight(order.weight_kg)} kg`} />
              <Info label="Harga/kg" value={formatRupiah(order.price_per_kg)} />
              <Info label="Total transaksi" value={formatRupiah(order.total_amount)} />
              <Info label="Level roasting" value={order.roast_level ? formatEnumLabel(order.roast_level) : '-'} />
              <Info label="Level giling" value={order.grind_level ?? '-'} />
              <Info label="Status produksi" value={formatEnumLabel(order.order_status)} />
              <Info label="Status bayar" value={formatEnumLabel(order.payment_status)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>Alur status</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">Progress transaksi berdasarkan status terbaru.</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="size-2 rounded-full bg-primary" />
                {formatDate(order.updated_at)}
              </div>
            </CardHeader>
            <CardContent>
              {order.order_status === 'DIBATALKAN' ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4">
                  <p className="text-sm font-semibold text-destructive">Transaksi dibatalkan</p>
                  <p className="mt-1 text-sm text-muted-foreground">Update terakhir {formatDate(order.updated_at)}</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-4">
                  {progressStatuses.map((status, index) => {
                    const currentIndex = progressStatuses.indexOf(order.order_status)
                    const stepIndex = progressStatuses.indexOf(status)
                    return (
                      <StatusStep
                        active={status === order.order_status}
                        done={stepIndex <= currentIndex}
                        index={index}
                        key={status}
                        label={formatEnumLabel(status)}
                      />
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {isCompleted && (
            <Card>
              <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                  <PanelIcon icon={Camera} />
                  <div>
                    <CardTitle>Foto bukti pengambilan</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">Dokumentasi wajib untuk transaksi yang selesai.</p>
                  </div>
                </div>
                <Button asChild size="sm" variant="outline">
                  <Link to={`/orders/${order.order_code}/pickup`}>
                    <Camera aria-hidden="true" className="size-4" />
                    Serah terima
                  </Link>
                </Button>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[18rem_1fr]">
                <div className="grid aspect-[4/3] place-items-center rounded-md border border-dashed border-border bg-muted">
                  {pickup?.photo_path ? (
                    <img
                      alt={`Bukti pengambilan ${order.order_code}`}
                      className="h-full w-full rounded-md object-cover"
                      src={pickup.photo_path}
                    />
                  ) : (
                    <div className="text-center">
                      <ImageIcon aria-hidden="true" className="mx-auto size-10 text-primary" />
                      <p className="mt-2 text-sm font-semibold">Belum ada preview foto</p>
                      <p className="text-xs text-muted-foreground">Lengkapi serah terima untuk menyimpan foto.</p>
                    </div>
                  )}
                </div>
                <div className="rounded-md border border-border bg-secondary/60 p-4">
                  {pickup ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Info label="Nama pengambil" value={pickup.recipient_name} />
                      <Info label="Tipe pengambil" value={formatEnumLabel(pickup.recipient_type)} />
                      <Info label="Telepon pengambil" value={pickup.recipient_phone ?? '-'} />
                      <Info label="Diserahkan oleh" value={pickup.handed_over_name} />
                      <Info label="Waktu pengambilan" value={formatDate(pickup.picked_up_at)} />
                      <Info label="Catatan" value={pickup.notes ?? '-'} />
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-semibold">Foto belum tercatat</p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Gunakan halaman serah terima untuk mencatat penerima dan mengunggah foto bukti pengambilan.
                      </p>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20">
          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <PanelIcon icon={CheckCircle2} />
                <div>
                  <CardTitle>Update status</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Simpan perubahan status ke database.</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Status sekarang</span>
                <OrderStatusBadge status={order.order_status} />
              </div>
              <Separator />
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="order-status">
                  Status baru
                </label>
                <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as OrderStatus)}>
                  <SelectTrigger id="order-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">{selectedStatusMeta?.description}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="status-notes">
                  Catatan update
                </label>
                <textarea
                  className="min-h-24 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  id="status-notes"
                  onChange={(event) => setStatusNotes(event.target.value)}
                  placeholder="Contoh: Kopi sudah selesai digiling."
                  value={statusNotes}
                />
              </div>
              <Button className="w-full" disabled={!canUpdateStatus} onClick={() => void handleUpdateStatus()}>
                <Save aria-hidden="true" className="size-4" />
                {isUpdating ? 'Menyimpan...' : 'Update status'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <PanelIcon icon={Banknote} />
                <div>
                  <CardTitle>Pembayaran</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Ringkasan kas untuk transaksi ini.</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <PaymentRow label="Total" value={formatRupiah(order.total_amount)} />
              <PaymentRow label="Terbayar" value={formatRupiah(order.paid_amount)} />
              <PaymentRow label="Sisa" strong value={formatRupiah(order.remaining)} />
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status bayar</span>
                <PaymentStatusBadge status={order.payment_status} />
              </div>
              {canSettlePayment && (
                <AppModal
                  description={`Sisa pembayaran ${order.order_code} akan dicatat lunas sebesar ${formatRupiah(order.remaining)}.`}
                  footer={
                    <>
                      <Button
                        disabled={isSettlingPayment}
                        onClick={() => setIsSettleModalOpen(false)}
                        type="button"
                        variant="outline"
                      >
                        Batal
                      </Button>
                      <Button disabled={isSettlingPayment} onClick={() => void handleSettlePayment()} type="button">
                        <Banknote aria-hidden="true" className="size-4" />
                        {isSettlingPayment ? 'Menyimpan...' : 'Simpan pelunasan'}
                      </Button>
                    </>
                  }
                  icon={<Banknote aria-hidden="true" className="size-5" />}
                  onOpenChange={setIsSettleModalOpen}
                  open={isSettleModalOpen}
                  title="Catat pelunasan"
                  trigger={
                    <Button className="w-full" type="button">
                      <Banknote aria-hidden="true" className="size-4" />
                      Catat pelunasan
                    </Button>
                  }
                >
                  <div className="space-y-3">
                    <div className="rounded-md border border-primary/20 bg-primary/5 p-4">
                      <PaymentRow label="Total order" value={formatRupiah(order.total_amount)} />
                      <div className="mt-2">
                        <PaymentRow label="Sudah dibayar" value={formatRupiah(order.paid_amount)} />
                      </div>
                      <div className="mt-2">
                        <PaymentRow label="Dibayar sekarang" strong value={formatRupiah(order.remaining)} />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium" htmlFor="settle-notes">
                        Catatan
                      </label>
                      <textarea
                        className="min-h-24 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        id="settle-notes"
                        onChange={(event) => setSettleNotes(event.target.value)}
                        placeholder="Contoh: Pelunasan saat pengambilan."
                        value={settleNotes}
                      />
                    </div>
                  </div>
                </AppModal>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="grid place-items-center gap-3 p-6 text-center">
              <div className="grid size-32 place-items-center rounded-md border border-border bg-muted">
                <QrCode aria-hidden="true" className="size-16 text-primary" />
              </div>
              <p className="text-sm font-semibold">{order.order_code}</p>
              <p className="text-xs text-muted-foreground">Label QR untuk scan pengambilan.</p>
            </CardContent>
          </Card>
        </aside>
      </section>
    </>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md border border-border bg-background p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold">{value}</p>
    </div>
  )
}

function PaymentRow({ label, strong, value }: { label: string; strong?: boolean; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={strong ? 'text-lg font-bold' : 'text-sm font-semibold'}>{value}</span>
    </div>
  )
}

function PanelIcon({ icon: Icon }: { icon: typeof UserRound }) {
  return (
    <span className="grid size-11 shrink-0 place-items-center rounded-md bg-secondary text-primary">
      <Icon aria-hidden="true" className="size-5" />
    </span>
  )
}

function StatusStep({ active, done, index, label }: { active: boolean; done: boolean; index: number; label: string }) {
  return (
    <div
      className={`min-w-0 rounded-md border px-3 py-3 ${
        active ? 'border-primary bg-secondary' : 'border-border bg-background'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold ${
            done ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}
        >
          {done ? <CheckCircle2 aria-hidden="true" className="size-3.5" /> : index + 1}
        </span>
        <span className="truncate text-sm font-semibold">{label}</span>
      </div>
      <div className="mt-3 h-1.5 rounded-full bg-muted">
        <div className={`h-full rounded-full ${done ? 'w-full bg-primary' : 'w-0 bg-primary'}`} />
      </div>
      {active && <p className="mt-2 text-xs font-medium text-primary">Saat ini</p>}
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
