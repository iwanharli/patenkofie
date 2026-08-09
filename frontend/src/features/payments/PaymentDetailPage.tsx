import { ArrowLeft, Pencil, Printer, ReceiptText, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'

import { AppModal } from '@/components/common/AppModal'
import { ConfirmModal } from '@/components/common/ConfirmModal'
import { PageHeader } from '@/components/common/PageHeader'
import { useToast } from '@/components/feedback/useToast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/features/auth/useAuth'
import { OrderStatusBadge, PaymentStatusBadge } from '@/features/orders/status'
import { useReceiptPrint } from '@/features/orders/useReceiptPrint'
import {
  fetchPayment,
  type PaymentRecord,
  updatePayment,
  voidPayment,
} from '@/features/payments/paymentsApi'
import { formatEnumLabel, formatRupiah } from '@/utils/format'

export function PaymentDetailPage() {
  const params = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { isPreparing: isPreparingReceipt, printReceipt } = useReceiptPrint({
    onError: () =>
      toast({
        title: 'Gagal mencetak',
        description: 'Struk gagal disiapkan. Coba lagi.',
        variant: 'destructive',
      }),
  })
  const { user } = useAuth()
  const [payment, setPayment] = useState<PaymentRecord | null>(null)
  const [isLoading, setIsLoading] = useState(Boolean(params.paymentCode))
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [editAmount, setEditAmount] = useState('')
  const [editNotes, setEditNotes] = useState('')

  const isOwner = user?.role === 'OWNER'

  function handleOpenEditModal() {
    if (!payment) return
    setEditAmount(String(payment.amount))
    setEditNotes(payment.notes ?? '')
    setIsEditModalOpen(true)
  }

  async function handleSaveEdit() {
    if (!payment) return
    const amountVal = parseInt(editAmount, 10)
    if (isNaN(amountVal) || amountVal <= 0) {
      toast({
        description: 'Nominal pembayaran harus lebih besar dari 0.',
        title: 'Input Tidak Valid',
        variant: 'destructive',
      })
      return
    }

    setIsSavingEdit(true)
    try {
      await updatePayment(payment.payment_code, {
        amount: amountVal,
        notes: editNotes,
      })
      const refreshed = await fetchPayment(payment.payment_code)
      setPayment(refreshed)
      setIsEditModalOpen(false)
      toast({
        description: `Pembayaran ${payment.payment_code} berhasil dikoreksi.`,
        title: 'Pembayaran Dikoreksi',
        variant: 'success',
      })
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : 'Gagal mengoreksi pembayaran.',
        title: 'Koreksi Gagal',
        variant: 'destructive',
      })
    } finally {
      setIsSavingEdit(false)
    }
  }

  async function handleVoidPayment() {
    if (!payment) return
    try {
      await voidPayment(payment.payment_code)
      toast({
        description: `Pembayaran ${payment.payment_code} berhasil dibatalkan. Sisa pembayaran order dihitung ulang.`,
        title: 'Pembayaran Dibatalkan',
        variant: 'success',
      })
      navigate('/payments')
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : 'Gagal membatalkan pembayaran.',
        title: 'Pembatalan Gagal',
        variant: 'destructive',
      })
    }
  }

  useEffect(() => {
    let isMounted = true

    if (!params.paymentCode) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    fetchPayment(params.paymentCode)
      .then((item) => {
        if (isMounted) {
          setPayment(item)
        }
      })
      .catch(() => {
        if (isMounted) {
          setPayment(null)
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
  }, [params.paymentCode])

  if (isLoading) {
    return <PageHeader description="Memuat bukti pembayaran." eyebrow="Detail pembayaran" title="Memuat..." />
  }

  if (!payment) {
    return (
      <PageHeader
        actions={
          <Button asChild variant="outline">
            <Link to="/payments">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Kembali
            </Link>
          </Button>
        }
        description="Kode pembayaran tidak ditemukan di database."
        eyebrow="Detail pembayaran"
        title="Pembayaran tidak ditemukan"
      />
    )
  }

  return (
    <>
      <PageHeader
        actions={
          <>
            <Button asChild variant="outline">
              <Link to="/payments">
                <ArrowLeft aria-hidden="true" className="size-4" />
                Kembali
              </Link>
            </Button>
            <Button
              disabled={isPreparingReceipt}
              onClick={() => printReceipt(payment.order_code)}
              variant="outline"
            >
              <Printer aria-hidden="true" className="size-4" />
              {isPreparingReceipt ? 'Menyiapkan...' : 'Cetak struk'}
            </Button>
            {isOwner && (
              <>
                <Button onClick={handleOpenEditModal} variant="outline">
                  <Pencil aria-hidden="true" className="size-4" />
                  Koreksi Nominal
                </Button>
                <ConfirmModal
                  confirmLabel="Batalkan Pembayaran"
                  description={`Record pembayaran ${payment.payment_code} sebesar ${formatRupiah(payment.amount)} akan dihapus. Sisa pembayaran transaksi ${payment.order_code} akan dihitung ulang secara otomatis.`}
                  onConfirm={() => void handleVoidPayment()}
                  title={`Batalkan Pembayaran ${payment.payment_code}?`}
                  trigger={
                    <Button variant="destructive">
                      <Trash2 aria-hidden="true" className="size-4" />
                      Batalkan Pembayaran
                    </Button>
                  }
                  variant="destructive"
                />
              </>
            )}
            <Button variant="outline">
              <Printer aria-hidden="true" className="size-4" />
              Cetak
            </Button>
          </>
        }
        description={`${payment.customer_name} - ${payment.payment_method} - ${formatDate(payment.paid_at)}`}
        eyebrow="Detail pembayaran"
        title={payment.payment_code}
      />

      <section className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <Card>
          <CardHeader>
            <CardTitle>Bukti pembayaran</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Info label="Order" value={payment.order_code} />
            <Info label="Pelanggan" value={payment.customer_name} />
            <Info label="Jenis pembayaran" value={formatEnumLabel(payment.payment_type)} />
            <Info label="Metode" value={payment.payment_method} />
            <Info label="Diterima oleh" value={payment.received_by_name} />
            <Info label="Waktu" value={formatDate(payment.paid_at)} />
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <div className="grid size-11 place-items-center rounded-md bg-secondary text-secondary-foreground">
                  <ReceiptText aria-hidden="true" className="size-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Nominal diterima</p>
                  <p className="text-2xl font-semibold">{formatRupiah(payment.amount)}</p>
                </div>
              </div>
              <Separator className="my-4" />
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Status order</span>
                  <OrderStatusBadge status={payment.order_status} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Status bayar</span>
                  <PaymentStatusBadge status={payment.order_payment_status} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-muted-foreground">Sisa order</span>
                  <span className="text-sm font-semibold">{formatRupiah(payment.order_remaining)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Catatan</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-6 text-muted-foreground">{payment.notes ?? 'Tidak ada catatan.'}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button asChild className="flex-1" variant="outline">
                  <Link to={`/orders/${payment.order_code}`}>Buka detail order</Link>
                </Button>
                <Badge variant="secondary">{formatEnumLabel(payment.payment_type)}</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <AppModal
        description="Koreksi nominal tunai atau catatan pembayaran. Sisa pembayaran transaksi akan diperbarui secara otomatis."
        onOpenChange={setIsEditModalOpen}
        open={isEditModalOpen}
        title={`Koreksi Pembayaran ${payment.payment_code}`}
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Nominal Pembayaran (Rp)</label>
            <Input
              className="mt-1"
              onChange={(e) => setEditAmount(e.target.value)}
              placeholder="Contoh: 150000"
              type="number"
              value={editAmount}
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase text-muted-foreground">Catatan Koreksi</label>
            <textarea
              className="mt-1 min-h-[80px] w-full rounded-md border border-input bg-background p-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Catatan alasan koreksi"
              value={editNotes}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button disabled={isSavingEdit} onClick={() => setIsEditModalOpen(false)} variant="outline">
              Batal
            </Button>
            <Button disabled={isSavingEdit} onClick={() => void handleSaveEdit()}>
              {isSavingEdit ? 'Menyimpan...' : 'Simpan Koreksi'}
            </Button>
          </div>
        </div>
      </AppModal>
    </>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold leading-6">{value}</p>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
