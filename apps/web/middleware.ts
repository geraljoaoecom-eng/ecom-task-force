import { NextRequest, NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  // Browser com bundle antigo a enviar Server Action requests → rejeitar com 400
  // Evita o crash interno do Next.js com "Cannot read workers"
  if (req.headers.get('next-action')) {
    return new NextResponse(JSON.stringify({ error: 'stale-build' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/((?!_next/static|_next/image|favicon.ico).*)',
}
