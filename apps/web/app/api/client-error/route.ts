import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const e = await req.json().catch(() => ({}))
    const msg = `[CLIENT-ERROR] ${e.type || 'error'} | ${e.url || '?'} | ${e.message || '?'}${e.source ? ` | ${e.source}:${e.line}` : ''}${e.stack ? '\n' + String(e.stack).slice(0, 600) : ''}`
    console.error(msg)
  } catch {}
  return new NextResponse(null, { status: 204 })
}
