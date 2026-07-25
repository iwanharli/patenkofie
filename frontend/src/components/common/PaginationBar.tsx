import { ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface PaginationBarProps {
  onPageChange: (page: number) => void
  page: number
  pageSize?: number
  totalItems: number
}

export function PaginationBar({
  onPageChange,
  page,
  pageSize = 10,
  totalItems,
}: PaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const safePage = Math.min(Math.max(page, 1), totalPages)
  const startItem = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1
  const endItem = Math.min(safePage * pageSize, totalItems)
  const canGoPrevious = safePage > 1
  const canGoNext = safePage < totalPages

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground">
        Menampilkan <span className="font-medium text-foreground">{startItem}-{endItem}</span> dari{' '}
        <span className="font-medium text-foreground">{totalItems}</span> data · {pageSize} per halaman
      </p>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <p className="shrink-0 text-muted-foreground">
          Halaman <span className="font-medium text-foreground">{safePage}</span>/{totalPages}
        </p>
        <div className="flex items-center gap-1">
          <Button
            aria-label="Halaman pertama"
            disabled={!canGoPrevious}
            onClick={() => onPageChange(1)}
            size="icon"
            variant="outline"
          >
            <ChevronsLeft aria-hidden="true" className="size-4" />
          </Button>
          <Button
            aria-label="Halaman sebelumnya"
            disabled={!canGoPrevious}
            onClick={() => onPageChange(safePage - 1)}
            size="icon"
            variant="outline"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>
          <Button
            aria-label="Halaman berikutnya"
            disabled={!canGoNext}
            onClick={() => onPageChange(safePage + 1)}
            size="icon"
            variant="outline"
          >
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
          <Button
            aria-label="Halaman terakhir"
            disabled={!canGoNext}
            onClick={() => onPageChange(totalPages)}
            size="icon"
            variant="outline"
          >
            <ChevronsRight aria-hidden="true" className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
