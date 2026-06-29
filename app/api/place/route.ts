import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getRoomByCode, getPlacementByStudentAndKind, addPlacement, getAnswer } from '@/lib/db';

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
    const emoji = String(body?.emoji || '');
    const x = Number(body?.x ?? 0);
    const y = Number(body?.y ?? 0);
    const answerId = body?.answerId ? Number(body.answerId) : null;

    if (!roomCode || !studentId || !kind || !emoji) {
      return json({ ok: false, error: 'ข้อมูลไม่ครบ' }, 400);
    }

    const room = getRoomByCode(roomCode);
    if (!room) return json({ ok: false, error: 'ไม่พบห้อง' }, 404);

    const PLACE_PHASE_FOR: Record<string, string> = { leaf: 'place_leaf', flower: 'place_flower', fruit: 'place_fruit' };
    if (room.current_phase !== PLACE_PHASE_FOR[kind]) {
      return json({ ok: false, error: `ตอนนี้ยังไม่ใช่ช่วงวาง ${kind}` }, 400);
    }

    const existing = getPlacementByStudentAndKind(room.id, studentId, kind);
    if (existing) return json({ ok: false, error: 'คุณได้วางรายการประเภทนี้แล้ว' }, 400);

    const placement = addPlacement({
      room_id: room.id,
      student_id: studentId,
      kind,
      answer_id: answerId ?? null,
      emoji,
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y)),
      scale: 1,
      rotation: 0,
    });

    const answer = placement.answer_id ? getAnswer(placement.answer_id) : null;
    return json({ ok: true, placement, answer: answer ? { id: answer.id, text: answer.text, studentId: answer.student_id } : null });
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500);
  }
}
