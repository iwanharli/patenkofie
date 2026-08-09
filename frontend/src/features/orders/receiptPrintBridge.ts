/**
 * Messages the hidden receipt frame sends back to the page that opened it, so
 * the opener knows when the frame can be torn down.
 */
export const RECEIPT_PRINT_MESSAGE = 'patenandum:receipt-print'

/**
 * `ready` fires just before the print dialog opens, `done` once it closes.
 * They are separate so the opener can drop its busy state as soon as the
 * dialog is up, without leaving the button stuck if `afterprint` never fires.
 */
export type ReceiptPrintStatus = 'done' | 'error' | 'ready'

const STATUSES: ReceiptPrintStatus[] = ['done', 'error', 'ready']

export interface ReceiptPrintMessage {
  status: ReceiptPrintStatus
  type: typeof RECEIPT_PRINT_MESSAGE
}

export function isReceiptPrintMessage(data: unknown): data is ReceiptPrintMessage {
  if (typeof data !== 'object' || data === null) {
    return false
  }

  const message = data as Partial<ReceiptPrintMessage>
  return (
    message.type === RECEIPT_PRINT_MESSAGE &&
    STATUSES.includes(message.status as ReceiptPrintStatus)
  )
}

export function postReceiptPrintStatus(status: ReceiptPrintStatus) {
  if (window.parent === window) {
    return
  }

  const message: ReceiptPrintMessage = { status, type: RECEIPT_PRINT_MESSAGE }
  window.parent.postMessage(message, window.location.origin)
}
