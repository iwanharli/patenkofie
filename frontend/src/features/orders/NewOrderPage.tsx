import {
  ArrowLeft,
  Banknote,
  Calculator,
  CheckCircle2,
  Coffee,
  MessageSquareText,
  Phone,
  ReceiptText,
  Save,
  Scale,
  UserRound,
} from 'lucide-react'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'

import { useToast } from '@/components/feedback/useToast'
import { PageHeader } from '@/components/common/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { fetchCustomerSuggestions, type CustomerSuggestionRecord } from '@/features/customers/customersApi'
import { createOrder, type CreateOrderPayload } from '@/features/orders/ordersApi'
import { fetchServices, type ServiceRecord } from '@/features/settings/servicesApi'
import { formatRupiah } from '@/utils/format'

export function NewOrderPage() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const [services, setServices] = useState<ServiceRecord[]>([])
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerSuggestionRecord[]>([])
  const [isCustomerSuggestionsOpen, setIsCustomerSuggestionsOpen] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)
  const [serviceCode, setServiceCode] = useState('GR')
  const [weightValue, setWeightValue] = useState('')
  const [weightUnit, setWeightUnit] = useState<'GRAM' | 'KG'>('KG')
  const [roastLevel, setRoastLevel] = useState<CreateOrderPayload['roast_level']>('MEDIUM')
  const [grindLevel, setGrindLevel] = useState('')
  const [notes, setNotes] = useState('')
  const [paymentType, setPaymentType] = useState<CreateOrderPayload['payment_type']>('DOWN_PAYMENT')
  const [paidAmount, setPaidAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  useEffect(() => {
    fetchServices()
      .then((data) => {
        setServices(data.filter((service) => service.is_active))
      })
      .catch(() => {
        toast({
          description: 'Harga layanan belum bisa dibaca dari database.',
          title: 'Gagal memuat layanan',
          variant: 'destructive',
        })
      })
  }, [toast])

  useEffect(() => {
    let isMounted = true
    const search = customerName.trim()

    if (search.length < 2) {
      setCustomerSuggestions([])
      setIsCustomerSuggestionsOpen(false)
      return
    }

    const timeoutID = window.setTimeout(() => {
      fetchCustomerSuggestions(search)
        .then((items) => {
          if (isMounted) {
            setCustomerSuggestions(items)
            setIsCustomerSuggestionsOpen(items.length > 0 && selectedCustomerId === null)
          }
        })
        .catch(() => {
          if (isMounted) {
            setCustomerSuggestions([])
            setIsCustomerSuggestionsOpen(false)
          }
        })
    }, 220)

    return () => {
      isMounted = false
      window.clearTimeout(timeoutID)
    }
  }, [customerName, selectedCustomerId])

  const selectedService = services.find((service) => service.code === serviceCode)
  const parsedWeight = parseDecimal(weightValue)
  const weightKg = weightUnit === 'GRAM' ? parsedWeight / 1000 : parsedWeight
  const totalAmount = useMemo(() => {
    if (!selectedService || weightKg <= 0) {
      return 0
    }

    return Math.round(weightKg * selectedService.price_per_kg)
  }, [selectedService, weightKg])

  const parsedPaidAmount = parseCurrency(paidAmount)
  const effectivePaidAmount = paymentType === 'FULL_PAYMENT'
    ? totalAmount
    : paymentType === 'PAY_LATER'
      ? 0
      : parsedPaidAmount
  const remainingAmount = Math.max(totalAmount - effectivePaidAmount, 0)

  function selectCustomerSuggestion(customer: CustomerSuggestionRecord) {
    setCustomerName(customer.name)
    setCustomerPhone(customer.phone ?? '')
    setSelectedCustomerId(customer.id)
    setIsCustomerSuggestionsOpen(false)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorMessage('')

    if (!customerName.trim()) {
      setErrorMessage('Nama pelanggan wajib diisi.')
      return
    }
    if (parsedWeight <= 0) {
      setErrorMessage('Berat masuk wajib lebih dari 0.')
      return
    }
    if (paymentType === 'DOWN_PAYMENT' && parsedPaidAmount <= 0) {
      setErrorMessage('Nominal DP wajib diisi.')
      return
    }

    setIsSubmitting(true)
    try {
      const order = await createOrder({
        customer_name: customerName,
        customer_phone: customerPhone,
        grind_level: grindLevel,
        notes,
        paid_amount: effectivePaidAmount,
        payment_type: paymentType,
        roast_level: roastLevel,
        service_code: serviceCode,
        weight_unit: weightUnit,
        weight_value: parsedWeight,
      })

      toast({
        description: `${order.customer_name} · ${order.service_name} · ${formatWeight(order.weight_kg)} kg`,
        title: `Transaksi ${order.order_code} dibuat`,
        variant: 'success',
      })
      navigate(`/orders/${order.order_code}`)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Transaksi gagal dibuat.')
      toast({
        description: error instanceof Error ? error.message : 'Coba periksa data transaksi.',
        title: 'Transaksi gagal dibuat',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <PageHeader
        actions={
          <Button asChild variant="outline">
            <Link to="/orders">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Kembali
            </Link>
          </Button>
        }
        description="Catat kopi masuk, berat dalam kilogram atau gram, dan pembayaran awal."
        eyebrow="Transaksi"
        title="Transaksi baru"
      />

      <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="gap-3 border-b border-border sm:flex-row sm:items-start">
              <SectionIcon icon={<UserRound aria-hidden="true" className="size-5" />} />
              <div>
                <CardTitle>Pelanggan</CardTitle>
                <CardDescription>Identitas pemilik kopi yang masuk hari ini.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 pt-5 md:grid-cols-2">
              <Field label="Nama pelanggan" required>
                <div className="relative">
                  <UserRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    onBlur={() => {
                      window.setTimeout(() => setIsCustomerSuggestionsOpen(false), 120)
                    }}
                    onChange={(event) => {
                      setCustomerName(event.target.value)
                      setSelectedCustomerId(null)
                      setIsCustomerSuggestionsOpen(true)
                    }}
                    onFocus={() => {
                      if (customerSuggestions.length > 0 && selectedCustomerId === null) {
                        setIsCustomerSuggestionsOpen(true)
                      }
                    }}
                    placeholder="Contoh: Budi Santoso"
                    value={customerName}
                  />
                  {isCustomerSuggestionsOpen && (
                    <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20 overflow-hidden rounded-md border border-border bg-popover shadow-md">
                      <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
                        Pelanggan tersimpan
                      </div>
                      <div className="max-h-72 overflow-y-auto p-1">
                        {customerSuggestions.map((customer) => (
                          <button
                            className="flex w-full items-start justify-between gap-3 rounded-sm px-3 py-2 text-left text-sm hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            key={customer.id}
                            onMouseDown={(event) => {
                              event.preventDefault()
                              selectCustomerSuggestion(customer)
                            }}
                            type="button"
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-semibold">{customer.name}</span>
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                {customer.phone ?? 'Tanpa nomor'} · {customer.total_orders} transaksi
                              </span>
                            </span>
                            <span className="shrink-0 text-right text-xs text-muted-foreground">
                              {customer.last_order_at ? formatShortDate(customer.last_order_at) : 'Baru'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Field>
              <Field label="Nomor telepon">
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="pl-9"
                    inputMode="tel"
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    placeholder="08xx"
                    value={customerPhone}
                  />
                </div>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-3 border-b border-border sm:flex-row sm:items-start">
              <SectionIcon icon={<Coffee aria-hidden="true" className="size-5" />} />
              <div>
                <CardTitle>Layanan dan berat</CardTitle>
                <CardDescription>Harga layanan dibaca dari database.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              <div className="grid gap-3 md:grid-cols-3">
                {services.map((service) => (
                  <ServiceOption
                    isSelected={service.code === serviceCode}
                    key={service.code}
                    onSelect={() => setServiceCode(service.code)}
                    service={service}
                  />
                ))}
                {services.length === 0 && (
                  <div className="rounded-md border border-dashed border-border px-4 py-5 text-sm text-muted-foreground md:col-span-3">
                    Memuat daftar layanan...
                  </div>
                )}
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
                <Field label="Berat masuk" required>
                  <div className="relative">
                    <Scale className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      inputMode="decimal"
                      onChange={(event) => setWeightValue(event.target.value)}
                      placeholder={weightUnit === 'KG' ? '10,5' : '10500'}
                      value={weightValue}
                    />
                  </div>
                </Field>
                <Field label="Satuan">
                  <Select onValueChange={(value) => setWeightUnit(value as 'GRAM' | 'KG')} value={weightUnit}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KG">Kilogram</SelectItem>
                      <SelectItem value="GRAM">Gram</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm">
                <span className="text-muted-foreground">Berat tersimpan: </span>
                <span className="font-semibold">{formatNumber(weightKg)} kg</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="gap-3 border-b border-border sm:flex-row sm:items-start">
              <SectionIcon icon={<MessageSquareText aria-hidden="true" className="size-5" />} />
              <div>
                <CardTitle>Preferensi proses</CardTitle>
                <CardDescription>Catatan kerja untuk operator produksi.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 pt-5 md:grid-cols-2">
              <Field label="Level roasting">
                <Select
                  onValueChange={(value) => setRoastLevel(value as CreateOrderPayload['roast_level'])}
                  value={roastLevel}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Tidak ada</SelectItem>
                    <SelectItem value="LIGHT">Light</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="DARK">Dark</SelectItem>
                    <SelectItem value="CUSTOM">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Tingkat gilingan">
                <Input
                  onChange={(event) => setGrindLevel(event.target.value)}
                  placeholder="Contoh: medium, halus"
                  value={grindLevel}
                />
              </Field>
              <div className="space-y-2 md:col-span-2">
                <Label>Catatan</Label>
                <textarea
                  className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Contoh: jangan terlalu gelap"
                  value={notes}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-20">
          <Card>
            <CardHeader className="border-b border-border">
              <div className="flex items-center gap-3">
                <SectionIcon icon={<ReceiptText aria-hidden="true" className="size-5" />} />
                <div>
                  <CardTitle>Ringkasan</CardTitle>
                  <CardDescription>Estimasi sebelum transaksi disimpan.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5 pt-5">
              <div className="rounded-md border border-primary/20 bg-primary/10 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
                    <Calculator aria-hidden="true" className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">Estimasi total</p>
                    <p className="mt-1 text-3xl font-semibold leading-none">{formatRupiah(totalAmount)}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Info
                  label="Layanan"
                  value={selectedService ? `${selectedService.code} · ${selectedService.name}` : '-'}
                />
                <Info
                  label="Harga"
                  value={selectedService ? `${formatRupiah(selectedService.price_per_kg)}/kg` : '-'}
                />
                <Info label="Berat" value={`${formatNumber(weightKg)} kg`} />
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <Field label="Skema pembayaran">
                  <Select
                    onValueChange={(value) => setPaymentType(value as CreateOrderPayload['payment_type'])}
                    value={paymentType}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FULL_PAYMENT">Lunas di awal</SelectItem>
                      <SelectItem value="DOWN_PAYMENT">DP</SelectItem>
                      <SelectItem value="PAY_LATER">Bayar setelah selesai</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                {paymentType === 'DOWN_PAYMENT' && (
                  <Field label="Pembayaran awal" required>
                    <div className="relative">
                      <Banknote className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        className="pl-9"
                        inputMode="numeric"
                        onChange={(event) => setPaidAmount(event.target.value)}
                        placeholder="50000"
                        value={paidAmount}
                      />
                    </div>
                  </Field>
                )}

                <div className="rounded-md border border-border bg-muted/50 p-3">
                  <Info label="Terbayar" value={formatRupiah(effectivePaidAmount)} />
                  <div className="mt-2">
                    <Info label="Sisa" value={formatRupiah(remainingAmount)} />
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {errorMessage}
                </div>
              )}

              <Button className="w-full" disabled={isSubmitting || services.length === 0} type="submit">
                <Save aria-hidden="true" className="size-4" />
                {isSubmitting ? 'Menyimpan...' : 'Simpan transaksi'}
              </Button>
            </CardContent>
          </Card>
        </aside>
      </section>
    </form>
  )
}

function parseDecimal(value: string) {
  const trimmed = value.trim()
  const normalized = trimmed.includes(',')
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed.replace(/[^0-9.]/g, '')
  const parsed = Number(normalized)

  return Number.isFinite(parsed) ? parsed : 0
}

function parseCurrency(value: string) {
  const parsed = Number(value.replace(/[^\d]/g, ''))

  return Number.isFinite(parsed) ? parsed : 0
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 3,
    minimumFractionDigits: 0,
  }).format(value)
}

function formatWeight(value: string) {
  return formatNumber(Number(value))
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
  }).format(new Date(value))
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-semibold">{value}</span>
    </div>
  )
}

function Field({
  children,
  label,
  required,
}: {
  children: React.ReactNode
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

function SectionIcon({ icon }: { icon: React.ReactNode }) {
  return (
    <div className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground">
      {icon}
    </div>
  )
}

function ServiceOption({
  isSelected,
  onSelect,
  service,
}: {
  isSelected: boolean
  onSelect: () => void
  service: ServiceRecord
}) {
  return (
    <button
      aria-pressed={isSelected}
      className={[
        'min-h-28 rounded-md border bg-background p-4 text-left transition-colors',
        'hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected ? 'border-primary bg-primary/10 shadow-sm' : 'border-border',
      ].join(' ')}
      onClick={onSelect}
      type="button"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">{service.name}</p>
          <p className="mt-1 text-xs font-medium text-muted-foreground">{service.code}</p>
        </div>
        {isSelected && <CheckCircle2 aria-hidden="true" className="size-5 shrink-0 text-primary" />}
      </div>
      <p className="mt-4 text-lg font-semibold">{formatRupiah(service.price_per_kg)}</p>
      <p className="text-xs text-muted-foreground">per kg</p>
    </button>
  )
}
