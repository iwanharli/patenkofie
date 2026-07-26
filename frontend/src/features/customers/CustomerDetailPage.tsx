import { Edit, Phone, Plus } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'

import { AppModal } from '@/components/common/AppModal'
import { PageHeader } from '@/components/common/PageHeader'
import { PaginationBar } from '@/components/common/PaginationBar'
import { useToast } from '@/components/feedback/useToast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  type CustomerOrderRecord,
  type CustomerRecord,
  fetchCustomer,
  updateCustomer,
} from '@/features/customers/customersApi'
import { OrderStatusBadge, PaymentStatusBadge } from '@/features/orders/status'
import { formatRupiah, formatWeight, WeightText } from '@/utils/format'

const ORDERS_PAGE_SIZE = 10

export function CustomerDetailPage() {
  const { toast } = useToast()
  const params = useParams()
  const customerID = Number(params.customerId) || 0
  const [customer, setCustomer] = useState<CustomerRecord | null>(null)
  const [orders, setOrders] = useState<CustomerOrderRecord[]>([])
  const [ordersTotalItems, setOrdersTotalItems] = useState(0)
  const [ordersPage, setOrdersPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

  // Modal edit customer state
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false)
  const [editError, setEditError] = useState('')

  useEffect(() => {
    if (customerID <= 0) {
      setErrorMessage('ID pelanggan tidak valid.')
      setIsLoading(false)
      return
    }

    let isMounted = true
    setIsLoading(true)

    fetchCustomer(customerID, ordersPage, ORDERS_PAGE_SIZE)
      .then((result) => {
        if (isMounted) {
          setCustomer(result)
          setOrders(result.orders)
          setOrdersTotalItems(result.orders_meta.total_items)
          setErrorMessage('')
        }
      })
      .catch(() => {
        if (isMounted) {
          setErrorMessage('Detail pelanggan gagal dimuat.')
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
  }, [customerID, ordersPage])

  function handleOpenEdit() {
    if (!customer) return
    setEditName(customer.name)
    setEditPhone(customer.phone ?? '')
    setEditAddress(customer.address ?? '')
    setEditNotes(customer.notes ?? '')
    setEditError('')
    setIsEditOpen(true)
  }

  async function handleSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (!customer) return

    if (!editName.trim()) {
      setEditError('Nama pelanggan wajib diisi.')
      return
    }

    setIsSubmittingEdit(true)
    setEditError('')

    try {
      const updated = await updateCustomer(customer.id, {
        address: editAddress.trim(),
        name: editName.trim(),
        notes: editNotes.trim(),
        phone: editPhone.trim(),
      })

      setCustomer((prev) =>
        prev
          ? {
              ...prev,
              address: updated.address,
              name: updated.name,
              notes: updated.notes,
              phone: updated.phone,
            }
          : null,
      )

      toast({
        description: `Data pelanggan ${updated.name} berhasil diperbarui.`,
        title: 'Pelanggan diperbarui',
        variant: 'success',
      })

      setIsEditOpen(false)
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Gagal mengubah data pelanggan.')
    } finally {
      setIsSubmittingEdit(false)
    }
  }

  if (isLoading) {
    return (
      <>
        <PageHeader eyebrow="Detail pelanggan" title="Memuat..." />
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Memuat data pelanggan dari database...
          </CardContent>
        </Card>
      </>
    )
  }

  if (errorMessage || !customer) {
    return (
      <>
        <PageHeader eyebrow="Detail pelanggan" title="Error" />
        <Card>
          <CardContent className="py-12 text-center text-destructive">
            {errorMessage || 'Pelanggan tidak ditemukan.'}
          </CardContent>
        </Card>
      </>
    )
  }

  return (
    <>
      <PageHeader
        actions={
          <>
            {customer.phone && (
              <Button asChild variant="outline">
                <a href={`tel:${customer.phone}`}>
                  <Phone aria-hidden="true" className="size-4" />
                  Hubungi
                </a>
              </Button>
            )}
            <Button asChild>
              <Link to="/orders/new">
                <Plus aria-hidden="true" className="size-4" />
                Transaksi baru
              </Link>
            </Button>
          </>
        }
        description={[customer.phone, customer.address].filter(Boolean).join(' · ') || 'Tanpa kontak'}
        eyebrow="Detail pelanggan"
        title={customer.name}
      />

      <section className="grid gap-4 xl:grid-cols-[1fr_22rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Profil pelanggan</CardTitle>
              <Button onClick={handleOpenEdit} size="sm" variant="outline">
                <Edit aria-hidden="true" className="size-4" />
                Ubah
              </Button>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Info label="Nomor telepon" value={customer.phone ?? '-'} />
              <Info label="Alamat" value={customer.address ?? '-'} />
              <Info label="Total order" value={`${customer.total_orders}`} />
              <Info label="Total volume" value={formatWeight(customer.total_weight_kg)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Riwayat order</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-y border-border bg-muted/70 text-left text-xs font-semibold uppercase text-muted-foreground">
                    <th className="px-5 py-3">Kode</th>
                    <th className="px-5 py-3">Layanan</th>
                    <th className="px-5 py-3">Berat</th>
                    <th className="px-5 py-3">Total</th>
                    <th className="px-5 py-3">Bayar</th>
                    <th className="px-5 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 && (
                    <tr>
                      <td className="px-5 py-8 text-muted-foreground" colSpan={6}>
                        Belum ada order untuk pelanggan ini.
                      </td>
                    </tr>
                  )}
                  {orders.map((order) => (
                    <tr className="border-b border-border last:border-b-0" key={order.order_code}>
                      <td className="px-5 py-4 font-medium">
                        <Link className="text-primary hover:underline" to={`/orders/${order.order_code}`}>
                          {order.order_code}
                        </Link>
                      </td>
                      <td className="px-5 py-4">{order.service_name}</td>
                      <td className="px-5 py-4">{formatWeight(order.weight_kg)}</td>
                      <td className="px-5 py-4 font-semibold">{formatRupiah(order.total_amount)}</td>
                      <td className="px-5 py-4">
                        <PaymentStatusBadge status={order.payment_status as 'BELUM_BAYAR' | 'DP' | 'LUNAS'} />
                      </td>
                      <td className="px-5 py-4">
                        <OrderStatusBadge status={order.order_status as 'DIBATALKAN' | 'DIPROSES' | 'MENUNGGU' | 'SELESAI' | 'SIAP_DIAMBIL'} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              <div className="grid gap-3 p-4 md:hidden">
                {orders.length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">Belum ada order untuk pelanggan ini.</div>
                )}
                {orders.map((order) => (
                  <Link
                    className="flex flex-col gap-3 rounded-md border border-border bg-background p-4 transition-colors hover:bg-muted/35"
                    key={order.order_code}
                    to={`/orders/${order.order_code}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-primary">{order.order_code}</p>
                        <p className="mt-1 text-sm font-medium">{order.service_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-foreground">{formatRupiah(order.total_amount)}</p>
                        <p className="mt-1 text-xs text-muted-foreground"><WeightText value={order.weight_kg} /></p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <PaymentStatusBadge status={order.payment_status as 'BELUM_BAYAR' | 'DP' | 'LUNAS'} />
                      <OrderStatusBadge status={order.order_status as 'DIBATALKAN' | 'DIPROSES' | 'MENUNGGU' | 'SELESAI' | 'SIAP_DIAMBIL'} />
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
            <PaginationBar
              onPageChange={setOrdersPage}
              page={ordersPage}
              pageSize={ORDERS_PAGE_SIZE}
              totalItems={ordersTotalItems}
            />
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ringkasan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Info
                label="Terakhir order"
                value={customer.last_order_at ? formatShortDate(customer.last_order_at) : 'Belum ada order'}
              />
              <Separator />
              <Info label="Total belanja" value={formatRupiah(customer.total_spent)} />
              <Separator />
              <Info
                label="Sisa pembayaran"
                value={customer.receivable > 0 ? formatRupiah(customer.receivable) : 'Rp0 (Lunas semua)'}
              />
              <Separator />
              <Info label="Catatan" value={customer.notes ?? '-'} />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Modal Edit Pelanggan */}
      <AppModal
        description="Perbarui informasi profil pelanggan ini."
        icon={<Edit className="size-5" />}
        onOpenChange={setIsEditOpen}
        open={isEditOpen}
        title="Ubah Data Pelanggan"
      >
        <form className="space-y-4 pt-2" onSubmit={(e) => void handleSaveEdit(e)}>
          {editError && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              {editError}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="edit-customer-name">Nama Pelanggan *</Label>
            <Input
              id="edit-customer-name"
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Nama pelanggan"
              required
              value={editName}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-customer-phone">Nomor Telepon</Label>
            <Input
              id="edit-customer-phone"
              onChange={(e) => setEditPhone(e.target.value)}
              placeholder="08xxxxxxxxxx"
              value={editPhone}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-customer-address">Alamat</Label>
            <textarea
              className="min-h-20 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              id="edit-customer-address"
              onChange={(e) => setEditAddress(e.target.value)}
              placeholder="Alamat pelanggan"
              value={editAddress}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-customer-notes">Catatan</Label>
            <textarea
              className="min-h-20 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              id="edit-customer-notes"
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Catatan khusus pelanggan..."
              value={editNotes}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              onClick={() => setIsEditOpen(false)}
              type="button"
              variant="outline"
            >
              Batal
            </Button>
            <Button disabled={isSubmittingEdit} type="submit">
              {isSubmittingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          </div>
        </form>
      </AppModal>
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



function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}
