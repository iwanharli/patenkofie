import { ArrowLeft, Printer } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'

import { Button } from '@/components/ui/button'
import { fetchOrder, type OrderRecord } from '@/features/orders/ordersApi'
import { postReceiptPrintStatus } from '@/features/orders/receiptPrintBridge'
import { fetchBusinessProfile } from '@/features/settings/settingsApi'
import { formatEnumLabel, formatRupiah, formatWeight } from '@/utils/format'

export function OrderReceiptPrintPage() {
  const params = useParams()
  const [searchParams] = useSearchParams()
  const isAutoPrint = searchParams.get('autoprint') === '1'
  const [order, setOrder] = useState<OrderRecord | null>(null)
  const [businessName, setBusinessName] = useState('PatenAndum')
  const [businessAddress, setBusinessAddress] = useState('')
  const [receiptFooter, setReceiptFooter] = useState('Terima kasih atas kunjungan Anda!')
  const [isLoading, setIsLoading] = useState(Boolean(params.orderCode))
  const [isProfileSettled, setIsProfileSettled] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const hasPrintedRef = useRef(false)

  useEffect(() => {
    fetchBusinessProfile().then((profile) => {
      if (profile.business_name) setBusinessName(profile.business_name)
      if (profile.business_address) setBusinessAddress(profile.business_address)
      if (profile.receipt_footer) setReceiptFooter(profile.receipt_footer)
    }).catch(() => {}).finally(() => setIsProfileSettled(true))
  }, [])

  useEffect(() => {
    if (!isAutoPrint) {
      return
    }

    const handleAfterPrint = () => postReceiptPrintStatus('done')
    window.addEventListener('afterprint', handleAfterPrint)
    return () => window.removeEventListener('afterprint', handleAfterPrint)
  }, [isAutoPrint])

  // Only fire once the order *and* the shop profile have resolved, otherwise
  // the receipt would go to paper with a placeholder header.
  useEffect(() => {
    if (!isAutoPrint || hasPrintedRef.current || isLoading || !isProfileSettled) {
      return
    }

    if (!order) {
      hasPrintedRef.current = true
      postReceiptPrintStatus('error')
      return
    }

    hasPrintedRef.current = true
    const timer = window.setTimeout(() => {
      window.focus()
      postReceiptPrintStatus('ready')
      window.print()
    }, 150)

    return () => window.clearTimeout(timer)
  }, [isAutoPrint, isLoading, isProfileSettled, order])

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

  if (isLoading) {
    return <PrintShell>Memuat struk...</PrintShell>
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
      <section
        className="mx-auto bg-white font-mono text-black print:m-0 print:bg-transparent"
        style={{ width: '58mm' }}
      >
        {/* Header Struk */}
        <div className="mb-4 text-center">
          <h1 className="text-sm font-bold uppercase leading-tight">{businessName}</h1>
          {businessAddress && (
            <p className="mt-1 whitespace-pre-wrap text-[10px] leading-tight">{businessAddress}</p>
          )}
        </div>

        {/* Info Transaksi */}
        <div className="mb-4 border-b border-dashed border-black pb-3 text-[10px] leading-tight">
          <div className="flex justify-between">
            <span>No:</span>
            <span>{order.order_code}</span>
          </div>
          <div className="flex justify-between mt-0.5">
            <span>Tgl:</span>
            <span>{formatDate(order.created_at)}</span>
          </div>
          <div className="flex justify-between mt-0.5">
            <span>Kasir:</span>
            <span>{order.created_by_name ?? 'Sistem'}</span>
          </div>
          <div className="flex justify-between mt-0.5">
            <span>Plg:</span>
            <span>{order.customer_name}</span>
          </div>
        </div>

        {/* Rincian Pesanan */}
        <div className="mb-4 text-[10px] leading-tight">
          <p className="font-bold">{order.service_name}</p>
          <div className="flex justify-between mt-1">
            <span>{formatWeight(order.weight_kg)} x {formatRupiah(order.price_per_kg)}</span>
            <span>{formatRupiah(order.total_amount)}</span>
          </div>
        </div>

        {/* Rincian Pembayaran */}
        <div className="mb-4 border-t border-dashed border-black pt-3 text-[10px] leading-tight">
          <div className="flex justify-between font-bold">
            <span>TOTAL:</span>
            <span>{formatRupiah(order.total_amount)}</span>
          </div>
          <div className="flex justify-between mt-0.5">
            <span>Status:</span>
            <span className="uppercase">{formatEnumLabel(order.payment_status)}</span>
          </div>
          <div className="flex justify-between mt-0.5">
            <span>Telah Dibayar:</span>
            <span>{formatRupiah(order.paid_amount)}</span>
          </div>
          {order.total_amount > order.paid_amount && (
            <div className="flex justify-between mt-0.5 font-bold">
              <span>SISA TAGIHAN:</span>
              <span>{formatRupiah(order.total_amount - order.paid_amount)}</span>
            </div>
          )}
        </div>

        {/* Status Pesanan */}
        <div className="mb-4 border-t border-dashed border-black pt-3 text-center text-[10px] leading-tight">
          <p>Status: <span className="font-bold uppercase">{formatEnumLabel(order.order_status)}</span></p>
        </div>

        {/* Footer Struk */}
        <div className="text-center text-[9px] leading-tight mt-6">
          <p className="whitespace-pre-wrap">{receiptFooter}</p>
        </div>
      </section>
    </PrintShell>
  )
}

function PrintShell({ children, orderCode }: { children: ReactNode; orderCode?: string }) {
  return (
    <main className="min-h-svh bg-background p-5 print:bg-white print:p-0 flex flex-col items-center">
      {/*
        No @page size here on purpose. CSS cannot express "58mm wide, height
        follows the content": `size: 58mm auto` is invalid (a length may not be
        mixed with auto) and browsers drop it, while `size: 58mm` would mean a
        58x58mm square and paginate a longer receipt. Continuous roll paper is
        the printer driver's job, so we leave the page size to it and constrain
        the receipt body to 58mm instead.
      */}
      <style>{'@media print { @page { margin: 2mm; } }'}</style>
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
      <div className="bg-muted p-4 shadow-sm border print:border-none print:shadow-none print:p-0 print:bg-transparent inline-block">
        {children}
      </div>
      <PrinterSetupGuide />
    </main>
  )
}

function PrinterSetupGuide() {
  return (
    <details className="mx-auto mt-4 w-full max-w-[420px] rounded-md border bg-muted/40 p-3 text-xs text-muted-foreground print:hidden">
      <summary className="cursor-pointer font-medium text-foreground">
        Cara pasang printer thermal 58mm (mis. ZJ-5809)
      </summary>
      <div className="mt-2 space-y-3">
        <div>
          <p className="font-medium text-foreground">Windows (via USB atau Bluetooth)</p>
          <ol className="mt-1 list-decimal space-y-1 pl-4">
            <li>Unduh driver resmi dari situs Zjiang (zjiang.com &gt; Service &gt; Driver), pilih driver untuk model ZJ-5809.</li>
            <li>Colok printer via kabel USB, atau nyalakan printer lalu pasangkan (pair) via Bluetooth di Settings &gt; Bluetooth &amp; devices &gt; Add device.</li>
            <li>Install driver yang sudah diunduh, lalu buka Settings &gt; Printers &amp; scanners &gt; pastikan printer (mis. "ZJ-5809") muncul dan berstatus siap.</li>
            <li>Jadikan sebagai printer default agar dialog cetak browser otomatis memilihnya (opsional).</li>
          </ol>
        </div>
        <div>
          <p className="font-medium text-foreground">Android / iOS</p>
          <ol className="mt-1 list-decimal space-y-1 pl-4">
            <li>Nyalakan printer dan pasangkan (pair) via Bluetooth di pengaturan HP.</li>
            <li>Install app print service bawaan printer (jika tersedia) agar printer terdaftar sebagai printer sistem, lalu cetak dari menu Share/Print browser.</li>
          </ol>
        </div>
        <p>
          Setelah printer terpasang sebagai printer sistem, klik tombol "Cetak" di atas lalu pilih printer tersebut pada dialog cetak.
        </p>
      </div>
    </details>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}
