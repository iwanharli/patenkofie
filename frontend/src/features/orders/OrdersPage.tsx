import { ArrowDownAZ, CheckSquare, RotateCcw, Search, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'

import { ConfirmModal } from '@/components/common/ConfirmModal'
import { useToast } from '@/components/feedback/useToast'
import { PageHeader } from '@/components/common/PageHeader'
import { PaginationBar } from '@/components/common/PaginationBar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/useAuth'
import {
  bulkUpdateOrderStatus,
  deleteOrder,
  fetchOrders,
  type OrderRecord,
  type OrderStatus,
} from '@/features/orders/ordersApi'
import { OrderStatusBadge, PaymentStatusBadge } from '@/features/orders/status'
import { formatEnumLabel, formatRupiah, WeightText } from '@/utils/format'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PAGE_SIZE = 10
const serviceOptions = [
  { label: 'Semua layanan', value: 'ALL' },
  { label: 'Giling saja', value: 'G' },
  { label: 'Roasting saja', value: 'R' },
  { label: 'Giling + roasting', value: 'GR' },
]
const orderStatusOptions = [
  { label: 'Semua status', value: 'ALL' },
  { label: 'Menunggu', value: 'MENUNGGU' },
  { label: 'Diproses', value: 'DIPROSES' },
  { label: 'Siap diambil', value: 'SIAP_DIAMBIL' },
  { label: 'Selesai', value: 'SELESAI' },
  { label: 'Dibatalkan', value: 'DIBATALKAN' },
]
const bulkStatusOptions: Array<{ label: string; value: OrderStatus }> = [
  { label: 'Menunggu', value: 'MENUNGGU' },
  { label: 'Diproses', value: 'DIPROSES' },
  { label: 'Siap diambil', value: 'SIAP_DIAMBIL' },
  { label: 'Dibatalkan', value: 'DIBATALKAN' },
]
const paymentStatusOptions = [
  { label: 'Semua bayar', value: 'ALL' },
  { label: 'Belum bayar', value: 'BELUM_BAYAR' },
  { label: 'DP', value: 'DP' },
  { label: 'Lunas', value: 'LUNAS' },
]
const sortOptions = [
  { label: 'Terbaru', sortBy: 'created_at', sortDirection: 'DESC', value: 'created_at:DESC' },
  { label: 'Terlama', sortBy: 'created_at', sortDirection: 'ASC', value: 'created_at:ASC' },
  { label: 'Kode A-Z', sortBy: 'code', sortDirection: 'ASC', value: 'code:ASC' },
  { label: 'Kode Z-A', sortBy: 'code', sortDirection: 'DESC', value: 'code:DESC' },
  { label: 'Pelanggan A-Z', sortBy: 'customer', sortDirection: 'ASC', value: 'customer:ASC' },
  { label: 'Pelanggan Z-A', sortBy: 'customer', sortDirection: 'DESC', value: 'customer:DESC' },
  { label: 'Total tertinggi', sortBy: 'total', sortDirection: 'DESC', value: 'total:DESC' },
  { label: 'Total terendah', sortBy: 'total', sortDirection: 'ASC', value: 'total:ASC' },
  { label: 'Berat tertinggi', sortBy: 'weight', sortDirection: 'DESC', value: 'weight:DESC' },
  { label: 'Berat terendah', sortBy: 'weight', sortDirection: 'ASC', value: 'weight:ASC' },
]

export function OrdersPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const [page, setPage] = useState(1)
  const [orders, setOrders] = useState<OrderRecord[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [serviceCode, setServiceCode] = useState('ALL')
  const [orderStatus, setOrderStatus] = useState('ALL')
  const [paymentStatus, setPaymentStatus] = useState('ALL')
  const [sortValue, setSortValue] = useState('created_at:DESC')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedOrderCodes, setSelectedOrderCodes] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState<OrderStatus>('DIPROSES')
  const [bulkNotes, setBulkNotes] = useState('')
  const isOwner = user?.role === 'OWNER'
  const selectedSort = sortOptions.find((option) => option.value === sortValue) ?? sortOptions[0]

  useEffect(() => {
    const timeoutID = window.setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
      setPage(1)
    }, 250)

    return () => window.clearTimeout(timeoutID)
  }, [searchTerm])

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)

    fetchOrders({
      orderStatus,
      page,
      pageSize: PAGE_SIZE,
      paymentStatus,
      search: debouncedSearchTerm,
      serviceCode,
      sortBy: selectedSort.sortBy,
      sortDirection: selectedSort.sortDirection as 'ASC' | 'DESC',
    })
      .then((result) => {
        if (isMounted) {
          setOrders(result.data)
          setTotalItems(result.meta.total_items)
          setErrorMessage('')
        }
      })
      .catch(() => {
        if (isMounted) {
          setErrorMessage('Daftar transaksi gagal dimuat dari database.')
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
  }, [debouncedSearchTerm, orderStatus, page, paymentStatus, refreshKey, selectedSort.sortBy, selectedSort.sortDirection, serviceCode])

  useEffect(() => {
    setSelectedOrderCodes((codes) => {
      const visibleCodes = new Set(orders.map((order) => order.order_code))
      return codes.filter((code) => visibleCodes.has(code))
    })
  }, [orders])

  const selectedOrderSet = useMemo(() => new Set(selectedOrderCodes), [selectedOrderCodes])
  const selectedOrders = useMemo(
    () => orders.filter((order) => selectedOrderSet.has(order.order_code)),
    [orders, selectedOrderSet],
  )
  const selectedOrderStatuses = useMemo(
    () => Array.from(new Set(selectedOrders.map((order) => order.order_status))),
    [selectedOrders],
  )
  const visibleOrderCodes = useMemo(() => orders.map((order) => order.order_code), [orders])
  const allVisibleSelected = visibleOrderCodes.length > 0 && visibleOrderCodes.every((code) => selectedOrderSet.has(code))
  const hasMixedSelectedStatuses = selectedOrderStatuses.length > 1
  const selectedSourceStatus = selectedOrderStatuses[0]

  function resetFilters() {
    setSearchTerm('')
    setDebouncedSearchTerm('')
    setServiceCode('ALL')
    setOrderStatus('ALL')
    setPaymentStatus('ALL')
    setSortValue('created_at:DESC')
    setPage(1)
  }

  function handleFilterChange(setter: (value: string) => void) {
    return (value: string) => {
      setter(value)
      setPage(1)
    }
  }

  async function handleDeleteOrder(order: OrderRecord) {
    try {
      await deleteOrder(order.order_code)
      toast({
        description: `${order.order_code} berhasil dihapus dari database.`,
        title: 'Transaksi dihapus',
        variant: 'success',
      })

      if (orders.length === 1 && page > 1) {
        setPage(page - 1)
      } else {
        setRefreshKey((value) => value + 1)
      }
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : 'Transaksi gagal dihapus.',
        title: 'Hapus transaksi gagal',
        variant: 'destructive',
      })
    }
  }

  function toggleOrderSelection(orderCode: string, checked: boolean) {
    setSelectedOrderCodes((codes) => {
      if (checked) {
        return codes.includes(orderCode) ? codes : [...codes, orderCode]
      }

      return codes.filter((code) => code !== orderCode)
    })
  }

  function toggleVisibleSelection(checked: boolean) {
    setSelectedOrderCodes(checked ? visibleOrderCodes : [])
  }

  async function handleBulkStatusUpdate() {
    if (selectedOrderCodes.length === 0) {
      return
    }
    if (hasMixedSelectedStatuses) {
      showMixedStatusWarning()
      return
    }

    try {
      const result = await bulkUpdateOrderStatus(selectedOrderCodes, bulkStatus, bulkNotes)
      const { not_found_count, skipped_count, updated_count } = result.data
      const extraInfo = [
        skipped_count > 0 ? `${skipped_count} dilewati` : '',
        not_found_count > 0 ? `${not_found_count} tidak ditemukan` : '',
      ].filter(Boolean)
      toast({
        description: [
          `${updated_count} transaksi diubah menjadi ${formatEnumLabel(bulkStatus)}.`,
          ...extraInfo,
        ].join(' '),
        title: 'Bulk status diperbarui',
        variant: 'success',
      })
      setBulkNotes('')
      setSelectedOrderCodes([])
      setRefreshKey((value) => value + 1)
    } catch (error) {
      toast({
        description: error instanceof Error ? error.message : 'Bulk update status gagal.',
        title: 'Bulk update gagal',
        variant: 'destructive',
      })
    }
  }

  function showMixedStatusWarning() {
    toast({
      description: 'Pilih transaksi dengan status produksi yang sama dulu, misalnya semua Menunggu atau semua Diproses.',
      title: 'Status pilihan berbeda',
      variant: 'warning',
    })
  }

  return (
    <>
      <PageHeader
        description="Daftar transaksi kopi masuk dengan pencarian, status produksi, dan saldo pembayaran."
        eyebrow="Operasional"
        title="Transaksi"
      />

      <Card>
        <CardHeader className="gap-4">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <CardTitle>Daftar pesanan</CardTitle>
            <div className="relative w-full xl:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Cari kode, pelanggan, atau telepon"
                value={searchTerm}
              />
            </div>
          </div>

          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_1.2fr_auto]">
            <FilterSelect label="Layanan" onValueChange={handleFilterChange(setServiceCode)} options={serviceOptions} value={serviceCode} />
            <FilterSelect label="Produksi" onValueChange={handleFilterChange(setOrderStatus)} options={orderStatusOptions} value={orderStatus} />
            <FilterSelect label="Pembayaran" onValueChange={handleFilterChange(setPaymentStatus)} options={paymentStatusOptions} value={paymentStatus} />
            <FilterSelect
              label="Urutkan"
              onValueChange={(value) => {
                setSortValue(value)
                setPage(1)
              }}
              options={sortOptions}
              value={sortValue}
            />
            <Button className="h-10 self-end" onClick={resetFilters} type="button" variant="outline">
              <RotateCcw aria-hidden="true" className="size-4" />
              Reset
            </Button>
          </div>
          {selectedOrderCodes.length > 0 && (
            <div className="flex flex-col gap-3 rounded-md border border-primary/20 bg-secondary/70 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                <CheckSquare aria-hidden="true" className="size-4 text-primary" />
                {selectedOrderCodes.length} transaksi dipilih
                {selectedSourceStatus && (
                  <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">
                    {hasMixedSelectedStatuses ? 'Status campur' : formatEnumLabel(selectedSourceStatus)}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setSelectedOrderCodes([])} size="sm" type="button" variant="outline">
                  <X aria-hidden="true" className="size-4" />
                  Batal
                </Button>
                {hasMixedSelectedStatuses ? (
                  <Button onClick={showMixedStatusWarning} size="sm" type="button">
                    <CheckSquare aria-hidden="true" className="size-4" />
                    Update status
                  </Button>
                ) : (
                  <ConfirmModal
                    confirmLabel={`Update ${selectedOrderCodes.length} transaksi`}
                    description={`Status akan diubah menjadi ${formatEnumLabel(bulkStatus)} dan dicatat ke log setiap transaksi.`}
                    onConfirm={() => void handleBulkStatusUpdate()}
                    title="Update status bulk?"
                    trigger={
                      <Button size="sm" type="button">
                        <CheckSquare aria-hidden="true" className="size-4" />
                        Update status
                      </Button>
                    }
                  >
                    <div className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="bulk-order-status">
                          Status baru
                        </label>
                        <Select value={bulkStatus} onValueChange={(value) => setBulkStatus(value as OrderStatus)}>
                          <SelectTrigger id="bulk-order-status">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {bulkStatusOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="bulk-status-notes">
                          Catatan
                        </label>
                        <textarea
                          className="min-h-24 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          id="bulk-status-notes"
                          onChange={(event) => setBulkNotes(event.target.value)}
                          placeholder="Contoh: Batch pagi selesai diproses."
                          value={bulkNotes}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Status Selesai tetap dilakukan dari detail/serah terima agar foto bukti pengambilan tercatat.
                      </p>
                    </div>
                  </ConfirmModal>
                )}
              </div>
            </div>
          )}
        </CardHeader>
        {errorMessage && (
          <div className="border-t border-border px-5 py-3 text-sm text-destructive">{errorMessage}</div>
        )}
        <CardContent className="p-0">
          <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[860px] border-collapse text-sm">
            <thead>
              <tr className="border-y border-border bg-muted/70 text-left text-xs font-semibold uppercase text-muted-foreground">
                <th className="w-12 px-5 py-3">
                  <input
                    aria-label="Pilih semua transaksi di halaman ini"
                    checked={allVisibleSelected}
                    className="size-4 rounded border-border accent-primary"
                    disabled={isLoading || orders.length === 0}
                    onChange={(event) => toggleVisibleSelection(event.target.checked)}
                    type="checkbox"
                  />
                </th>
                <th className="px-5 py-3">Kode</th>
                <th className="px-5 py-3">Pelanggan</th>
                <th className="px-5 py-3">Layanan</th>
                <th className="px-5 py-3">Berat</th>
                <th className="px-5 py-3">Total</th>
                <th className="px-5 py-3">Pembayaran</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td className="px-5 py-8 text-muted-foreground" colSpan={9}>
                    Memuat transaksi dari database...
                  </td>
                </tr>
              )}
              {!isLoading && orders.length === 0 && (
                <tr>
                  <td className="px-5 py-8 text-muted-foreground" colSpan={9}>
                    Belum ada transaksi yang cocok.
                  </td>
                </tr>
              )}
              {!isLoading && orders.map((order) => (
                <tr className="border-b border-border last:border-b-0" key={order.order_code}>
                  <td className="px-5 py-4">
                    <input
                      aria-label={`Pilih ${order.order_code}`}
                      checked={selectedOrderSet.has(order.order_code)}
                      className="size-4 rounded border-border accent-primary"
                      onChange={(event) => toggleOrderSelection(order.order_code, event.target.checked)}
                      type="checkbox"
                    />
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <p className="font-medium">{order.order_code}</p>
                    <p className="text-xs text-muted-foreground">{formatShortDate(order.created_at)}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium">{order.customer_name}</p>
                    <p className="text-xs text-muted-foreground">{order.customer_phone ?? '-'}</p>
                  </td>
                  <td className="px-5 py-4">{order.service_name}</td>
                  <td className="px-5 py-4"><WeightText value={order.weight_kg} /></td>
                  <td className="px-5 py-4 font-medium">{formatRupiah(order.total_amount)}</td>
                  <td className="px-5 py-4">
                    <PaymentStatusBadge status={order.payment_status as 'BELUM_BAYAR' | 'DP' | 'LUNAS'} />
                  </td>
                  <td className="px-5 py-4">
                    <OrderStatusBadge
                      status={order.order_status as 'DIBATALKAN' | 'DIPROSES' | 'MENUNGGU' | 'SELESAI' | 'SIAP_DIAMBIL'}
                    />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link to={`/orders/${order.order_code}`}>Detail</Link>
                      </Button>
                      {isOwner && (
                        <ConfirmModal
                          confirmLabel="Hapus"
                          description="Transaksi, pembayaran, status log, dan data serah terima terkait akan dihapus dari database."
                          onConfirm={() => void handleDeleteOrder(order)}
                          title={`Hapus ${order.order_code}?`}
                          trigger={
                            <Button aria-label={`Hapus ${order.order_code}`} size="sm" variant="destructive">
                              <Trash2 aria-hidden="true" className="size-4" />
                            </Button>
                          }
                          variant="destructive"
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>

          <div className="grid gap-3 p-4 md:hidden">
            {isLoading && (
              <div className="p-4 text-center text-sm text-muted-foreground">Memuat transaksi dari database...</div>
            )}
            {!isLoading && orders.length === 0 && (
              <div className="p-4 text-center text-sm text-muted-foreground">Belum ada transaksi yang cocok.</div>
            )}
            {!isLoading && orders.map((order) => (
              <OrderMobileCard 
                isOwner={isOwner} 
                key={order.order_code} 
                onDelete={() => void handleDeleteOrder(order)} 
                onSelect={(checked) => toggleOrderSelection(order.order_code, checked)} 
                order={order} 
                selected={selectedOrderSet.has(order.order_code)} 
              />
            ))}
          </div>
        </CardContent>
        <PaginationBar
          onPageChange={setPage}
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={totalItems}
        />
      </Card>
    </>
  )
}

function FilterSelect({
  label,
  onValueChange,
  options,
  value,
}: {
  label: string
  onValueChange: (value: string) => void
  options: Array<{ label: string; value: string }>
  value: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase text-muted-foreground">
        {label === 'Urutkan' && <ArrowDownAZ aria-hidden="true" className="size-3.5" />}
        <span>{label}</span>
      </div>
      <Select onValueChange={onValueChange} value={value}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}



function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
  }).format(new Date(value))
}

function OrderMobileCard({
  isOwner,
  onDelete,
  onSelect,
  order,
  selected,
}: {
  isOwner: boolean
  onDelete: () => void
  onSelect: (selected: boolean) => void
  order: OrderRecord
  selected: boolean
}) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="pt-1">
            <input
              aria-label={`Pilih ${order.order_code}`}
              checked={selected}
              className="size-4 rounded border-border accent-primary"
              onChange={(event) => onSelect(event.target.checked)}
              type="checkbox"
            />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-primary">{order.order_code}</p>
            <p className="mt-1 truncate text-sm text-muted-foreground">{order.customer_name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{formatShortDate(order.created_at)}</p>
          </div>
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
      <div className="mt-2 flex items-center justify-between">
        <div className="text-sm font-medium">{order.service_name}</div>
        <div className="flex justify-end gap-2">
          <Button asChild size="sm" variant="outline">
            <Link to={`/orders/${order.order_code}`}>Detail</Link>
          </Button>
          {isOwner && (
            <ConfirmModal
              confirmLabel="Hapus"
              description="Transaksi, pembayaran, status log, dan data serah terima terkait akan dihapus dari database."
              onConfirm={onDelete}
              title={`Hapus ${order.order_code}?`}
              trigger={
                <Button aria-label={`Hapus ${order.order_code}`} size="sm" variant="destructive">
                  <Trash2 aria-hidden="true" className="size-4" />
                </Button>
              }
              variant="destructive"
            />
          )}
        </div>
      </div>
    </div>
  )
}
