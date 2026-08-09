import { Plus, Receipt, Trash2, Edit2 } from 'lucide-react'
import { useEffect, useState, useCallback, type FormEvent } from 'react'

import { PageHeader } from '@/components/common/PageHeader'
import { PaginationBar } from '@/components/common/PaginationBar'
import { useAuth } from '@/features/auth/useAuth'
import { AppModal } from '@/components/common/AppModal'
import { useToast } from '@/components/feedback/useToast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  type ExpenseRecord,
  type ExpenseFormData,
  fetchExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
} from '@/features/expenses/expensesApi'
import { formatRupiah } from '@/utils/format'
import { DialogClose } from '@/components/ui/dialog'

const PAGE_SIZE = 10

function getTodayInputValue() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function ExpensesPage() {
  const { toast } = useToast()
  const { user } = useAuth()
  const isOwner = user?.role === 'OWNER'
  const todayInputValue = getTodayInputValue()
  const [startDate, setStartDate] = useState(todayInputValue)
  const [endDate, setEndDate] = useState(todayInputValue)
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
  const [totalItems, setTotalItems] = useState(0)
  const [totalAmount, setTotalAmount] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)

  // Form states
  const [amount, setAmount] = useState<string>('')
  const [category, setCategory] = useState<ExpenseFormData['category']>('OPERASIONAL')
  const [description, setDescription] = useState('')
  const [expenseDate, setExpenseDate] = useState(todayInputValue)
  const [isSaving, setIsSaving] = useState(false)

  const loadData = useCallback(() => {
    setIsLoading(true)
    fetchExpenses({ startDate, endDate, page, pageSize: PAGE_SIZE })
      .then((result) => {
        setExpenses(result.data || [])
        setTotalItems(result.meta.total_items)
        setTotalAmount(result.meta.total_amount)
      })
      .catch(() => {
        toast({
          title: 'Gagal memuat',
          description: 'Data kas kecil gagal dimuat dari server.',
          variant: 'destructive',
        })
      })
      .finally(() => setIsLoading(false))
  }, [startDate, endDate, page, toast])

  useEffect(() => {
    loadData()
  }, [loadData])

  useEffect(() => {
    setPage(1)
  }, [startDate, endDate])

  const handleOpenAdd = () => {
    setAmount('')
    setCategory('OPERASIONAL')
    setDescription('')
    setExpenseDate(getTodayInputValue())
    setEditingId(null)
    setIsModalOpen(true)
  }

  const handleOpenEdit = (item: ExpenseRecord) => {
    setAmount(String(item.amount))
    setCategory(item.category)
    setDescription(item.description)
    setExpenseDate(item.expense_date)
    setEditingId(item.id)
    setIsModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Yakin ingin menghapus pengeluaran ini?')) return
    try {
      await deleteExpense(id)
      toast({
        title: 'Dihapus',
        description: 'Pengeluaran berhasil dihapus.',
        variant: 'success',
      })
      if (expenses.length === 1 && page > 1) {
        setPage(page - 1)
      } else {
        loadData()
      }
    } catch (err: any) {
      toast({
        title: 'Gagal menghapus',
        description: err.message,
        variant: 'destructive',
      })
    }
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!description || !amount) {
      toast({ title: 'Gagal', description: 'Harap isi semua kolom.', variant: 'destructive' })
      return
    }

    setIsSaving(true)
    const payload = {
      amount: parseInt(amount, 10),
      category,
      description,
      expense_date: expenseDate,
    }

    try {
      if (editingId) {
        await updateExpense(editingId, payload)
        toast({ title: 'Diperbarui', description: 'Pengeluaran berhasil diperbarui.', variant: 'success' })
      } else {
        await createExpense(payload)
        toast({ title: 'Tersimpan', description: 'Pengeluaran berhasil ditambahkan.', variant: 'success' })
      }
      setIsModalOpen(false)
      loadData()
    } catch (err: any) {
      toast({
        title: 'Gagal menyimpan',
        description: err.message,
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const getCategoryLabel = (cat: string) => {
    switch (cat) {
      case 'OPERASIONAL': return 'Operasional'
      case 'BAHAN_BAKU': return 'Bahan Baku'
      case 'LAINNYA': return 'Lainnya'
      default: return cat
    }
  }

  return (
    <>
      <PageHeader
        actions={
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex gap-2">
              <label className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
                <span className="text-xs font-medium text-muted-foreground">Dari</span>
                <Input
                  className="h-auto w-32 border-0 bg-transparent p-0 focus-visible:ring-0"
                  onChange={(e) => setStartDate(e.target.value)}
                  type="date"
                  value={startDate}
                />
              </label>
              <label className="flex h-10 items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
                <span className="text-xs font-medium text-muted-foreground">Sampai</span>
                <Input
                  className="h-auto w-32 border-0 bg-transparent p-0 focus-visible:ring-0"
                  onChange={(e) => setEndDate(e.target.value)}
                  type="date"
                  value={endDate}
                />
              </label>
            </div>
            <AppModal
              description={editingId ? 'Ubah rincian pengeluaran.' : 'Catat pengeluaran baru (Petty Cash).'}
              footer={
                <>
                  <DialogClose asChild>
                    <Button variant="outline" onClick={() => setIsModalOpen(false)}>Batal</Button>
                  </DialogClose>
                  <Button disabled={isSaving} onClick={onSubmit}>
                    {isSaving ? 'Menyimpan...' : 'Simpan'}
                  </Button>
                </>
              }
              icon={<Receipt aria-hidden="true" className="size-5" />}
              open={isModalOpen}
              onOpenChange={setIsModalOpen}
              title={editingId ? 'Edit Pengeluaran' : 'Tambah Pengeluaran'}
              trigger={
                <Button onClick={handleOpenAdd}>
                  <Plus aria-hidden="true" className="size-4" />
                  Catat Pengeluaran
                </Button>
              }
            >
              <form className="grid gap-4" onSubmit={onSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="expense_date">Tanggal</Label>
                  <Input 
                    id="expense_date" 
                    type="date" 
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Kategori</Label>
                  <Select
                    onValueChange={(val) => setCategory(val as ExpenseFormData['category'])}
                    value={category}
                  >
                    <SelectTrigger id="category">
                      <SelectValue placeholder="Pilih kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="OPERASIONAL">Operasional (Listrik, bensin, dll)</SelectItem>
                      <SelectItem value="BAHAN_BAKU">Bahan Baku (Biji kopi, susu, cup)</SelectItem>
                      <SelectItem value="LAINNYA">Lainnya</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Keterangan</Label>
                  <Input 
                    id="description" 
                    placeholder="Contoh: Beli token listrik" 
                    value={description}
                    onChange={(e) => setDescription(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="amount">Nominal (Rp)</Label>
                  <Input 
                    id="amount" 
                    type="number" 
                    min="0" 
                    placeholder="0" 
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)} 
                  />
                </div>
              </form>
            </AppModal>
          </div>
        }
        description="Kelola catatan pengeluaran harian toko (Kas Kecil)."
        eyebrow="Keuangan"
        title="Kas Kecil"
      />

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Pengeluaran</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRupiah(totalAmount)}</div>
            <p className="text-xs text-muted-foreground mt-1">Pada rentang tanggal terpilih</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[700px] border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">Tanggal</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Keterangan</th>
                <th className="px-4 py-3 font-medium text-muted-foreground">Kategori</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Nominal</th>
                {isOwner && (
                  <th className="w-[100px] px-4 py-3 text-right font-medium text-muted-foreground">Aksi</th>
                )}
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td className="h-32 text-center text-muted-foreground" colSpan={isOwner ? 5 : 4}>
                    {isLoading ? 'Memuat data...' : 'Belum ada catatan pengeluaran.'}
                  </td>
                </tr>
              ) : (
                expenses.map((item) => (
                  <tr key={item.id} className="border-b transition-colors hover:bg-muted/50">
                    <td className="px-4 py-3 font-medium">
                      {new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(item.expense_date))}
                    </td>
                    <td className="px-4 py-3">{item.description}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary">{getCategoryLabel(item.category)}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatRupiah(item.amount)}
                    </td>
                    {isOwner && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            aria-label="Edit"
                            onClick={() => handleOpenEdit(item)}
                            size="icon"
                            variant="ghost"
                          >
                            <Edit2 aria-hidden="true" className="size-4" />
                          </Button>
                          <Button
                            aria-label="Hapus"
                            className="text-destructive"
                            onClick={() => handleDelete(item.id)}
                            size="icon"
                            variant="ghost"
                          >
                            <Trash2 aria-hidden="true" className="size-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
        <PaginationBar onPageChange={setPage} page={page} pageSize={PAGE_SIZE} totalItems={totalItems} />
      </Card>
    </>
  )
}
