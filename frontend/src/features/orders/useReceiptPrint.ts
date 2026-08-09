import { useCallback, useEffect, useRef, useState } from 'react'

import { isReceiptPrintMessage } from '@/features/orders/receiptPrintBridge'

// Safety net: if the frame never reports back (user left the print dialog open,
// navigation stalled), drop it rather than leaking frames into the page.
const CLEANUP_FALLBACK_MS = 120_000

interface UseReceiptPrintOptions {
  onError?: () => void
}

/**
 * Prints a receipt through an off-screen frame, so the browser print dialog
 * opens over the current page instead of routing the user through a new tab.
 */
export function useReceiptPrint({ onError }: UseReceiptPrintOptions = {}) {
  const frameRef = useRef<HTMLIFrameElement | null>(null)
  const timerRef = useRef<number | null>(null)
  const onErrorRef = useRef(onError)
  const [isPreparing, setIsPreparing] = useState(false)

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  const cleanup = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
    frameRef.current?.remove()
    frameRef.current = null
    setIsPreparing(false)
  }, [])

  useEffect(() => cleanup, [cleanup])

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || !isReceiptPrintMessage(event.data)) {
        return
      }

      // The dialog is open: the opener is no longer "preparing", but the frame
      // must stay attached until printing finishes.
      if (event.data.status === 'ready') {
        setIsPreparing(false)
        return
      }

      if (event.data.status === 'error') {
        onErrorRef.current?.()
      }
      cleanup()
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [cleanup])

  const printReceipt = useCallback(
    (orderCode: string) => {
      cleanup()
      setIsPreparing(true)

      const frame = document.createElement('iframe')
      frame.title = 'Cetak struk'
      frame.setAttribute('aria-hidden', 'true')
      frame.setAttribute('tabindex', '-1')
      // Park the frame off-screen rather than hiding it: a display:none or
      // zero-sized frame prints blank in several browsers.
      frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:420px;height:600px;border:0;'
      frame.src = `/print/orders/${encodeURIComponent(orderCode)}/receipt?autoprint=1`

      document.body.appendChild(frame)
      frameRef.current = frame
      timerRef.current = window.setTimeout(cleanup, CLEANUP_FALLBACK_MS)
    },
    [cleanup],
  )

  return { isPreparing, printReceipt }
}
