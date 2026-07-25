import { Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'

import { PageHeader } from '@/components/common/PageHeader'
import { PaginationBar } from '@/components/common/PaginationBar'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { customers } from '@/features/shared/mockData'
import { getPaginatedItems } from '@/utils/pagination'

const PAGE_SIZE = 10

export function CustomersPage() {
  const [page, setPage] = useState(1)
  const paginatedCustomers = getPaginatedItems(customers, page, PAGE_SIZE)

  return (
    <>
      <PageHeader
        actions={
          <Button>
            <Plus aria-hidden="true" className="size-4" />
            Pelanggan baru
          </Button>
        }
        description="Data pelanggan, riwayat transaksi, dan volume kopi per pelanggan."
        eyebrow="Master data"
        title="Pelanggan"
      />

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle>Daftar pelanggan</CardTitle>
          <div className="relative w-full md:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Cari nama atau telepon" />
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {paginatedCustomers.map((customer) => (
            <Link
              className="rounded-lg border border-border bg-background p-4 text-foreground transition-colors hover:bg-accent"
              key={customer.phone}
              to={`/customers/${customer.id}`}
            >
              <p className="font-semibold">{customer.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{customer.phone}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-md bg-muted p-3">
                  <p className="text-muted-foreground">Order</p>
                  <p className="font-semibold">{customer.orders}</p>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <p className="text-muted-foreground">Volume</p>
                  <p className="font-semibold">{customer.volume}</p>
                </div>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Terakhir: {customer.lastOrder}</p>
            </Link>
          ))}
        </CardContent>
        <PaginationBar
          onPageChange={setPage}
          page={page}
          pageSize={PAGE_SIZE}
          totalItems={customers.length}
        />
      </Card>
    </>
  )
}
