import QRCode from 'qrcode'
import { ArrowLeft, Printer } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'

import { Button } from '@/components/ui/button'
import { fetchOrder, type OrderRecord } from '@/features/orders/ordersApi'
import { fetchBusinessProfile } from '@/features/settings/settingsApi'
import { formatEnumLabel, formatRupiah, formatWeight } from '@/utils/format'

export function OrderLabelPrintPage() {
  const params = useParams()
  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [businessName, setBusinessName] = useState('PatenAndum')
  const [receiptFooter, setReceiptFooter] = useState('Scan QR untuk membuka detail transaksi dan proses serah terima.')
  const [isLoading, setIsLoading] = useState(Boolean(params.orderCode))
  const [errorMessage, setErrorMessage] = useState('')
  const detailUrl = useMemo(() => {
    if (!order) {
      return ''
    }

    return `${window.location.origin}/orders/${order.order_code}`
  }, [order])

  useEffect(() => {
    fetchBusinessProfile().then((profile) => {
      if (profile.business_name) setBusinessName(profile.business_name)
      if (profile.receipt_footer) setReceiptFooter(profile.receipt_footer)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    let isMounted = true

    if (!params.orderCode) {
      setIsLoading(false)
      setErrorMessage('Kode transaksi tidak tersedia.')
      return
    }

    fetchOrder(params.orderCode)
      .then((item) => {
        if (isMounted) {
          setOrder(item)
          setErrorMessage('')
        }
      })
      .catch(() => {
        if (isMounted) {
          setOrder(null)
          setErrorMessage('Transaksi tidak ditemukan.')
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
    let isMounted = true

    if (!detailUrl) {
      setQrDataUrl('')
      return
    }

    QRCode.toDataURL(detailUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      scale: 8,
      width: 220,
    }).then((dataUrl) => {
      if (isMounted) {
        setQrDataUrl(dataUrl)
      }
    })

    return () => {
      isMounted = false
    }
  }, [detailUrl])

  if (isLoading) {
    return <PrintShell>Memuat label transaksi...</PrintShell>
  }

  if (!order) {
    return (
      <PrintShell>
        <div className="rounded-md border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
          {errorMessage}
        </div>
      </PrintShell>
    )
  }

  return (
    <PrintShell orderCode={order.order_code}>
      <section className="order-label-paper mx-auto w-full max-w-[420px] rounded-md border border-border bg-white p-5 text-foreground shadow-sm print:shadow-none">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">{businessName}</p>
            <h1 className="mt-1 text-xl font-bold leading-tight">{order.order_code}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{formatDate(order.created_at)}</p>
          </div>
          <div className="rounded-md border border-border bg-background p-1.5">
            {qrDataUrl ? (
              <img alt={`QR ${order.order_code}`} className="size-28" src={qrDataUrl} />
            ) : (
              <div className="grid size-28 place-items-center text-xs text-muted-foreground">QR</div>
            )}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 border-y border-border py-3">
          <LabelInfo label="Pelanggan" value={order.customer_name} />
          <LabelInfo label="Telepon" value={order.customer_phone ?? '-'} />
          <LabelInfo label="Layanan" value={`${order.service_code} - ${order.service_name}`} />
          <LabelInfo label="Berat" value={formatWeight(order.weight_kg)} />
          <LabelInfo label="Kasir/Penerima" value={order.created_by_name ?? 'Sistem'} />
          <LabelInfo label="Bayar" value={formatEnumLabel(order.payment_status)} />
        </div>

        <div className="mt-3 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase text-muted-foreground">Total</p>
            <p className="text-lg font-bold">{formatRupiah(order.total_amount)}</p>
          </div>
          <p className="max-w-44 text-right text-[11px] leading-snug text-muted-foreground">
            {receiptFooter}
          </p>
        </div>
      </section>
    </PrintShell>
  )
}

function PrintShell({ children, orderCode }: { children: ReactNode; orderCode?: string }) {
  return (
    <main className="min-h-svh bg-background p-5 print:bg-white print:p-0">
      <style>{'@media print { @page { size: 90mm 60mm; margin: 4mm; } }'}</style>
      <div className="mx-auto mb-4 flex w-full max-w-[420px] items-center justify-between gap-3 print:hidden">
        <Button asChild variant="outline">
          <Link to={orderCode ? `/orders/${orderCode}` : '/orders'}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            Kembali
          </Link>
        </Button>
        <Button onClick={() => window.print()} type="button">
          <Printer aria-hidden="true" className="size-4" />
          Cetak
        </Button>
      </div>
      {children}
    </main>
  )
}

function LabelInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase text-muted-foreground">{label}</p>
      <p className="truncate text-sm font-semibold">{value}</p>
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}


