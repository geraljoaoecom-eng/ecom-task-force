import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminMiddleware';
import bcrypt from 'bcryptjs';
import { updateUser, deleteUser } from '@/lib/db';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request);
    const body = await request.json();
    const userId = params.id;

    const updateData: Record<string, unknown> = {};
    if (body.email) updateData.email = body.email;
    if (body.name !== undefined) updateData.name = body.name;
    if (body.role) updateData.role = body.role;
    if (body.password) updateData.password = await bcrypt.hash(body.password, 10);

    await updateUser(userId, updateData);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireAdmin(request);
    await deleteUser(params.id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
