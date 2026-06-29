import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { createRoom, getRoomByCode } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const q_leaf = String(body?.q_leaf ?? '').trim();
    const q_flower = String(body?.q_flower ?? '').trim();
    const q_fruit = String(body?.q_fruit ?? '').trim();

    if (!q_leaf || !q_flower || !q_fruit) {
      return json({ ok: false, error: 'กรุณาตั้งคำถามครบทั้ง 3 ข้อ' }, 400);
    }

    const room = createRoom({ q_leaf, q_flower, q_fruit });
    return json({ ok: true, code: room.code, teacherToken: room.teacher_token });
  } catch (error) {
    return json({ ok: false, error: String(error) }, 500);
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = String(url.searchParams.get('code') || '').toUpperCase();
  if (!code) {
    return json({ ok: false, error: 'ต้องระบุ code' }, 400);
  }
  const room = getRoomByCode(code);
  if (!room) {
    return json({ ok: false, error: 'ไม่พบห้อง' }, 404);
  }
  return json({ ok: true, room: { code: room.code, q_leaf: room.q_leaf, q_flower: room.q_flower, q_fruit: room.q_fruit, current_phase: room.current_phase } });
}
