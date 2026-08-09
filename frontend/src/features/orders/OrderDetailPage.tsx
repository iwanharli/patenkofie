import {
  ArrowLeft,
  Banknote,
  Camera,
  CheckCircle2,
  History,
  ImageIcon,
  PackageCheck,
  Pencil,
  Printer,
  Save,
  Trash2,
  UserRound,
  ZoomIn,
} from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { AppModal } from '@/components/common/AppModal'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { PageHeader } from '@/components/common/PageHeader'
import { useToast } from '@/components/feedback/useToast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/features/auth/useAuth'
import {
  deleteOrder,
  fetchOrder,
  type OrderRecord,
  type OrderStatus,
  updateOrder,
  updateOrderStatus,
} from '@/features/orders/ordersApi'
import { useReceiptPrint } from '@/features/orders/useReceiptPrint'
import { fetchPickup, type PickupRecord } from '@/features/orders/pickupsApi'
import { OrderStatusBadge, PaymentStatusBadge } from '@/features/orders/status'
import { settleOrderPayment } from '@/features/payments/paymentsApi'
import { fetchServices, type ServiceRecord } from '@/features/settings/servicesApi'
import { formatEnumLabel, formatRupiah, formatWeight } from '@/utils/format'

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
  const { isPreparing: isPreparingReceipt, printReceipt } = useReceiptPrint({
    onError: () =>
      toast({
        title: 'Gagal mencetak',
        description: 'Struk gagal disiapkan. Coba lagi.',
        variant: 'destructive',
      }),
  })
  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [pickup, setPickup] = useState<PickupRecord | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(params.orderCode))
  const [isUpdating, setIsUpdating] = useState(false)
  const [isSettlingPayment, setIsSettlingPayment] = useState(false)
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false)
  const [settleNotes, setSettleNotes] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>('MENUNGGU')
  const [statusNotes, setStatusNotes] = useState('')

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [servicesList, setServicesList] = useState<ServiceRecord[]>([])
  const [editServiceCode, setEditServiceCode] = useState('G')
  const [editWeightValue, setEditWeightValue] = useState('')
  const [editWeightUnit, setEditWeightUnit] = useState<'KG' | 'GRAM'>('KG')
  const [editNotes, setEditNotes] = useState('')
  const [editCustomerName, setEditCustomerName] = useState('')
  const [editCustomerPhone, setEditCustomerPhone] = useState('')
  const [editRoastLevel, setEditRoastLevel] = useState('NONE')
  const [editGrindLevel, setEditGrindLevel] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')

  useEffect(() => {
    if (!order) return
    const detailUrl = `${window.location.origin}/orders/${order.order_code}`
    QRCode.toDataURL(detailUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 200,
    })
      .then(setQrDataUrl)
      .catch(() => {})
  }, [order])

  const canDelete = user?.role === 'OWNER' && Boolean(order)
  const canEdit = Boolean(order && (order.order_status === 'MENUNGGU' || order.order_status === 'DIPROSES'))
  const isCompleted = order?.order_status === 'SELESAI'
  const selectedStatusMeta = useMemo(
    () => statusOptions.find((item) => item.value === selectedStatus),
    [selectedStatus],
  )

  function handleOpenEditModal() {
    if (!order) return
    setIsLoading(true)
    fetchServices()
      .then((items) => {
        setServicesList(items)
        setEditCustomerName(order.customer_name)
        setEditCustomerPhone(order.customer_phone ?? '')
        setEditRoastLevel(order.roast_level ?? 'NONE')
        setEditGrindLevel(order.grind_level ?? '')
        setEditServiceCode(order.service_code)
        setEditWeightValue(order.weight_kg)
        setEditWeightUnit('KG')
        setEditNotes(order.notes ?? '')
        setIsEditModalOpen(true)
      })
      .catch(() => {
        toast({
          description: 'Gagal memuat daftar layanan dari database.',
          title: 'Error',
          variant: 'destructive',
        })
      })
      .finally(() => {
        setIsLoading(false)
      })
  }

  async function handleSaveEdit() {
    if (!order) return
    if (!editCustomerName.trim()) {
      toast({
        description: 'Nama pelanggan tidak boleh kosong.',
        title: 'Input Tidak Valid',
        variant: 'destructive',
      })
      return
    }
    const rawVal = parseFloat(editWeightValue)
    if (isNaN(rawVal) || rawVal <= 0) {
      toast({
        description: 'Berat harus lebih besar dari 0.',
        title: 'Input Tidak Valid',
        variant: 'destructive',
      })
      return
    }

    const weightGrams = editWeightUnit === 'KG' ? Math.round(rawVal * 1000) : Math.round(rawVal)

    setIsSavingEdit(true)
    try {
      const updated = await updateOrder(order.order_code, {
        customer_name: editCustomerName.trim(),
        customer_phone: editCustomerPhone.trim() || null,
        grind_level: editGrindLevel.trim() || null,
        notes: editNotes,
        roast_level: editRoastLevel !== 'NONE' ? editRoastLevel : null,
        service_code: editServiceCode,
        weight_grams: weightGrams,
      })
      setOrder(updated)
      setIsEditModalOpen(false)
      toast({
        description: `Transaksi ${order.order_code} berhasil diperbarui.`,
        title: 'Transaksi Diperbarui',
        variant: 'success',
      })
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : 'Gagal memperbarui transaksi.',
        title: 'Update Gagal',
        variant: 'destructive',
      })
    } finally {
      setIsSavingEdit(false)
    }
  }

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
            <Button
              disabled={isPreparingReceipt}
              onClick={() => printReceipt(order.order_code)}
              variant="outline"
            >
              <Printer aria-hidden="true" className="size-4" />
              {isPreparingReceipt ? 'Menyiapkan...' : 'Cetak struk'}
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
        description={`${order.customer_name} - ${order.service_name} - ${formatWeight(order.weight_kg)}`}
        eyebrow="Detail transaksi"
        title={
          <div className="flex items-center gap-3">
            <span>{order.order_code}</span>
            {qrDataUrl && (
              <Dialog>
                <DialogTrigger asChild>
                  <button className="group relative overflow-hidden rounded-md border border-border bg-white p-1 shadow-sm transition-all hover:ring-2 hover:ring-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <img
                      alt={`QR ${order.order_code}`}
                      className="size-8 object-contain transition-transform group-hover:scale-105"
                      src={qrDataUrl}
                    />
                    <div className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                      <ZoomIn className="size-4 text-white opacity-80" />
                    </div>
                  </button>
                </DialogTrigger>
                <DialogContent className="max-w-sm border-none bg-transparent p-0 shadow-none">
                  <div className="rounded-xl border border-border bg-white p-6 shadow-2xl">
                    <img
                      alt={`QR ${order.order_code} Fullscreen`}
                      className="h-auto w-full rounded object-contain"
                      src={qrDataUrl}
                    />
                    <p className="mt-4 text-center text-sm font-semibold text-foreground">
                      Scan QR dari layar untuk membuka order
                    </p>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        }
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
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Nama pelanggan" value={order.customer_name} />
              <Info label="Telepon" value={order.customer_phone ?? '-'} />
              <Info label="Kode transaksi" value={order.order_code} />
              <Info label="Petugas Penerima (Input)" value={order.created_by_name ?? 'Sistem'} />
              <Info label="Petugas Serah Terima" value={order.picked_up_by_name ?? 'Belum diambil'} />
              <Info label="Tanggal masuk" value={formatDate(order.created_at)} />
              <Info label="Terakhir diubah" value={formatDate(order.updated_at)} />
              <Info label="Catatan" value={order.notes ?? '-'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <PanelIcon icon={PackageCheck} />
                <div>
                  <CardTitle>Detail layanan</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Rincian pekerjaan dan perhitungan harga.</p>
                </div>
              </div>
              {canEdit && (
                <Button onClick={handleOpenEditModal} size="sm" variant="outline">
                  <Pencil aria-hidden="true" className="size-4" />
                  Ubah
                </Button>
              )}
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Layanan" value={`${order.service_code} - ${order.service_name}`} />
              <Info label="Berat masuk" value={formatWeight(order.weight_kg)} />
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

          <Card>
            <CardHeader>
              <div className="flex items-start gap-3">
                <PanelIcon icon={History} />
                <div>
                  <CardTitle>Riwayat Perubahan Status & Petugas</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">Kronologi pergerakan status pesanan dan petugas perubahnya.</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.status_logs && order.status_logs.length > 0 ? (
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-left text-xs font-sans">
                    <thead className="border-b border-border bg-muted/60 text-muted-foreground uppercase font-semibold">
                      <tr>
                        <th className="px-4 py-2.5">Waktu</th>
                        <th className="px-4 py-2.5">Perubahan Status</th>
                        <th className="px-4 py-2.5">Petugas Perubah</th>
                        <th className="px-4 py-2.5">Catatan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {order.status_logs.map((logItem, idx) => (
                        <tr className="hover:bg-muted/20" key={idx}>
                          <td className="px-4 py-2.5 whitespace-nowrap text-muted-foreground">
                            {formatDate(logItem.changed_at)}
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap font-medium">
                            <span className="text-muted-foreground">{formatEnumLabel(logItem.previous_status || 'BARU')}</span>
                            <span className="mx-1.5 text-primary">→</span>
                            <span className="font-semibold">{formatEnumLabel(logItem.new_status)}</span>
                          </td>
                          <td className="px-4 py-2.5 whitespace-nowrap font-semibold">
                            {logItem.changed_by_name}
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground">
                            {logItem.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-md border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
                  Belum ada log perubahan status tambahan. Petugas penerima awal: <strong className="text-foreground">{order.created_by_name ?? 'Sistem'}</strong>.
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
                    <Dialog>
                      <DialogTrigger asChild>
                        <button className="group relative h-full w-full overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <img
                            alt={`Bukti pengambilan ${order.order_code}`}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                            src={pickup.photo_path}
                          />
                          <div className="absolute inset-0 grid place-items-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                            <ZoomIn className="size-8 text-white opacity-80" />
                          </div>
                        </button>
                      </DialogTrigger>
                      <DialogContent className="max-w-5xl border-none bg-transparent p-0 shadow-none">
                        <img
                          alt={`Bukti pengambilan ${order.order_code} Fullscreen`}
                          className="h-auto max-h-[90vh] w-full rounded-md object-contain"
                          src={pickup.photo_path}
                        />
                      </DialogContent>
                    </Dialog>
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


        </aside>
      </section>

      <AppModal
        description="Ubah layanan, berat kopi, dan catatan transaksi. Harga total dan sisa pembayaran akan dihitung ulang secara otomatis."
        onOpenChange={setIsEditModalOpen}
        open={isEditModalOpen}
        title={`Ubah Transaksi ${order.order_code}`}
      >
        <div className="space-y-4 pt-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">Nama Pelanggan</label>
              <Input
                className="mt-1"
                onChange={(e) => setEditCustomerName(e.target.value)}
                placeholder="Nama lengkap"
                value={editCustomerName}
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">Telepon Pelanggan</label>
              <Input
                className="mt-1"
                onChange={(e) => setEditCustomerPhone(e.target.value)}
                placeholder="Nomor HP/WA"
                value={editCustomerPhone}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Jenis Layanan</label>
            <Select value={editServiceCode} onValueChange={setEditServiceCode}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Pilih layanan" />
              </SelectTrigger>
              <SelectContent>
                {servicesList.map((srv) => (
                  <SelectItem key={srv.code} value={srv.code}>
                    {srv.code} - {srv.name} ({formatRupiah(srv.price_per_kg)}/kg)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase text-muted-foreground">Berat Kopi</label>
              <div className="flex items-center gap-1 rounded bg-muted p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setEditWeightUnit('KG')}
                  className={`rounded px-2 py-0.5 font-medium transition-all ${
                    editWeightUnit === 'KG'
                      ? 'bg-background font-semibold text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  KG
                </button>
                <button
                  type="button"
                  onClick={() => setEditWeightUnit('GRAM')}
                  className={`rounded px-2 py-0.5 font-medium transition-all ${
                    editWeightUnit === 'GRAM'
                      ? 'bg-background font-semibold text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Gram
                </button>
              </div>
            </div>
            <Input
              className="mt-1"
              onChange={(e) => setEditWeightValue(e.target.value)}
              placeholder={editWeightUnit === 'KG' ? 'Misal: 5.5' : 'Misal: 5500'}
              step="any"
              type="number"
              value={editWeightValue}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">Level Roasting</label>
              <Select value={editRoastLevel} onValueChange={setEditRoastLevel}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Pilih level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">- Tidak Ada -</SelectItem>
                  <SelectItem value="LIGHT">Light</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="DARK">Dark</SelectItem>
                  <SelectItem value="CUSTOM">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase text-muted-foreground">Level Giling</label>
              <Input
                className="mt-1"
                onChange={(e) => setEditGrindLevel(e.target.value)}
                placeholder="Contoh: Kasar, Halus, Espresso"
                value={editGrindLevel}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Catatan</label>
            <textarea
              className="mt-1 min-h-[80px] w-full rounded-md border border-input bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Catatan tambahan (opsional)"
              value={editNotes}
            />
          </div>

          {(() => {
            const srv = servicesList.find((s) => s.code === editServiceCode)
            const rawVal = parseFloat(editWeightValue || '0')
            const grams = editWeightUnit === 'KG' ? Math.round(rawVal * 1000) : Math.round(rawVal)
            const estTotal = srv && grams > 0 ? Math.round((grams / 1000) * srv.price_per_kg) : 0
            return (
              <div className="space-y-1 rounded-md bg-secondary p-3 text-xs font-medium">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Harga Layanan:</span>
                  <span className="font-semibold">{srv ? `${formatRupiah(srv.price_per_kg)}/kg` : '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Berat:</span>
                  <span className="font-semibold">{(grams / 1000).toFixed(3)} kg</span>
                </div>
                <div className="flex justify-between border-t border-border/50 pt-1 text-sm font-bold text-primary">
                  <span>Estimasi Total:</span>
                  <span>{formatRupiah(estTotal)}</span>
                </div>
              </div>
            )
          })()}

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button disabled={isSavingEdit} onClick={() => setIsEditModalOpen(false)} variant="outline">
              Batal
            </Button>
            <Button disabled={isSavingEdit} onClick={() => void handleSaveEdit()}>
              {isSavingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </div>
        </div>
      </AppModal>
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


