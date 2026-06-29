import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { addAnswer, getRoomByCode } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const roomCode = String(body?.roomCode || '').toUpperCase();
    const studentId = Number(body?.studentId || 0);
    const kind = String(body?.kind || '');
    const text = String(body?.text || '').trim();

    if (!roomCode || !studentId || !kind || !text) {
      return json({ ok: false, error: 'ข้อมูลไม่ครบ' }, 400);
    }

    const room = getRoomByCode(roomCode);
    if (!room) return json({ ok: false, error: 'ไม่พบห้อง' }, 404);

    // ตรวจ phase
    const ANSWER_PHASE_FOR: Record<string, string> = { leaf: 'answer_leaf', flower: 'answer_flower', fruit: 'answer_fruit' };
    if (room.current_phase !== ANSWER_PHASE_FOR[kind]) {
      return json({ ok: false, error: `ตอนนี้ยังไม่ใช่ช่วงตอบ ${kind}` }, 400);
    }

    const answer = addAnswer(room.id, studentId, kind as any, text);
    return json({ ok: true, answer });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
