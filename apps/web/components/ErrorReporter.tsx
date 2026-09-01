'use client'

import { useEffect } from 'react'

export default function ErrorReporter() {
  useEffect(() => {
    const send = (payload: object) => {
      try {
        navigator.sendBeacon('/api/client-error', JSON.stringify(payload))
      } catch {}
    }

    const onError = (e: ErrorEvent) => {
      send({
        type: 'uncaught',
        message: e.message,
        source: e.filename,
        line: e.lineno,
        col: e.colno,
        stack: e.error?.stack,
        url: location.pathname,
        ua: navigator.userAgent.slice(0, 120),
      })
    }

    const onUnhandled = (e: PromiseRejectionEvent) => {
      send({
        type: 'unhandledRejection',
        message: String(e.reason),
        stack: e.reason?.stack,
        url: location.pathname,
      })
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandled)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandled)
    }
  }, [])

  return null
}
