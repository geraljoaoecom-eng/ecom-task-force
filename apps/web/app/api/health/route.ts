import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    database: 'Supabase',
    message: 'Sistema operacional',
    port: '3000 (unified)'
  });
}
