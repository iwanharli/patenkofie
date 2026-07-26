import { Search, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/common/PageHeader'
import { PaginationBar } from '@/components/common/PaginationBar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { type CustomerRecord, fetchCustomers } from '@/features/customers/customersApi'
import { formatRupiah, formatWeight } from '@/utils/format'

const PAGE_SIZE = 12

export function CustomersPage() {
  const [page, setPage] = useState(1)
  const [customers, setCustomers] = useState<CustomerRecord[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState('')

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

    fetchCustomers({
      page,
      pageSize: PAGE_SIZE,
      search: debouncedSearchTerm,
    })
      .then((result) => {
        if (isMounted) {
          setCustomers(result.data)
          setTotalItems(result.meta.total_items)
          setErrorMessage('')
        }
      })
      .catch(() => {
        if (isMounted) {
          setErrorMessage('Daftar pelanggan gagal dimuat dari database.')
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
  }, [debouncedSearchTerm, page])

  return (
    <>
      <PageHeader
        description="Data pelanggan, riwayat transaksi, dan volume kopi per pelanggan."
        eyebrow="Master data"
        title="Pelanggan"
      />

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle>Daftar pelanggan</CardTitle>
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Cari nama atau telepon"
              value={searchTerm}
            />
          </div>
        </CardHeader>
        {errorMessage && (
          <div className="border-t border-border px-5 py-3 text-sm text-destructive">{errorMessage}</div>
        )}
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {isLoading && (
            <p className="col-span-full py-8 text-muted-foreground">Memuat pelanggan dari database...</p>
          )}
          {!isLoading && customers.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Users aria-hidden="true" className="size-10 text-muted-foreground/50" />
              <p className="text-muted-foreground">Belum ada pelanggan yang cocok.</p>
            </div>
          )}
          {!isLoading && customers.map((customer) => (
            <Link
              className="rounded-lg border border-border bg-background p-4 text-foreground transition-colors hover:bg-accent"
              key={customer.id}
              to={`/customers/${customer.id}`}
            >
              <p className="font-semibold">{customer.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{customer.phone ?? '-'}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-muted p-3">
                  <p className="text-muted-foreground">Order</p>
                  <p className="font-semibold">{customer.total_orders}</p>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <p className="text-muted-foreground">Volume</p>
                  <p className="font-semibold">{formatWeight(customer.total_weight_kg)}</p>
                </div>
              </div>
              {customer.receivable > 0 && (
                <p className="mt-3 text-xs font-medium text-amber-600 dark:text-amber-400">
                  Piutang: {formatRupiah(customer.receivable)}
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Terakhir: {customer.last_order_at ? formatShortDate(customer.last_order_at) : 'Belum ada order'}
              </p>
            </Link>
          ))}
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



function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value))
}
