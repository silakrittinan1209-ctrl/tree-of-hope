'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getSocket } from '@/lib/socket-client';
import TreeCanvas, { TreeCanvasHandle } from '@/components/TreeCanvas';
import ItemTray from '@/components/ItemTray';
import {
  KIND_LABEL, actionFromPhase, kindFromPhase,
  type Answer, type Kind, type Phase, type Placement, type Snapshot,
} from '@/lib/types';

function PlayInner() {
  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const code = String(params.code).toUpperCase();
  const name = search.get('name') || (typeof window !== 'undefined' ? sessionStorage.getItem('player_name') || 'ไม่ระบุชื่อ' : 'ไม่ระบุชื่อ');

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [phase, setPhase] = useState<Phase>('answer_leaf');
  const [studentId, setStudentId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [answerText, setAnswerText] = useState('');
  const [myAnswers, setMyAnswers] = useState<Partial<Record<Kind, Answer>>>({});
  const [savedFlash, setSavedFlash] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState<string>('');
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [connected, setConnected] = useState(false);

  const canvasRef = useRef<TreeCanvasHandle>(null);
  const sidRef = useRef<number | null>(null);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);

  const kind = kindFromPhase(phase);
  const action = actionFromPhase(phase);
  const hasAnsweredCurrent = !!myAnswers[kind];
  const hasPlacedCurrent = !!placements.find(p => p.student_id === studentId && p.kind === kind);

  const questionFor = (k: Kind) =>
    k === 'leaf' ? snapshot?.room.q_leaf : k === 'flower' ? snapshot?.room.q_flower : snapshot?.room.q_fruit;

  // ---------- socket ----------
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;
    setConnected(socket.connected);

    const onConnect = () => {
      setConnected(true);
      socket.emit('join_room', { roomCode: code, role: 'student', name }, (res: any) => {
        if (!res?.ok) { setError(res?.error || 'เข้าร่วมห้องไม่สำเร็จ'); return; }
        const snap = res.snapshot as Snapshot | undefined;
        setStudentId(res.studentId);
        sidRef.current = res.studentId;
        setSnapshot(snap ?? null);
        setPhase(snap?.room?.current_phase ?? 'answer_leaf');
        setPlacements(snap?.placements ?? []);
        const mine: Partial<Record<Kind, Answer>> = {};
        for (const a of snap?.answers ?? []) {
          if (a.student_id === res.studentId && (a.kind === 'leaf' || a.kind === 'flower' || a.kind === 'fruit')) {
            mine[a.kind] = a;
          }
        }
        setMyAnswers(mine);
      });
    };

    if (socket.connected) onConnect();
    else socket.on('connect', onConnect);

    const onDisconnect = () => setConnected(false);
    const onItemPlaced = (data: any) => setPlacements(p => [...p, data.placement]);
    const onItemRemoved = (data: any) => setPlacements(p => p.filter(x => x.id !== data.placementId));
    const onPhaseChanged = (d: { phase: Phase }) => { setPhase(d.phase); setSelectedEmoji(''); };
    const onTreeReset = () => {
      setPlacements([]);
      setSnapshot(null);
      setStudentId(null);
      setError('ห้องถูกล้างแล้ว กรุณารีเฟรชเพื่อเข้าร่วมใหม่');
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('item_placed', onItemPlaced);
    socket.on('item_removed', onItemRemoved);
    socket.on('phase_changed', onPhaseChanged);
    socket.on('tree_reset', onTreeReset);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('item_placed', onItemPlaced);
      socket.off('item_removed', onItemRemoved);
      socket.off('phase_changed', onPhaseChanged);
      socket.off('tree_reset', onTreeReset);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  // ---------- ส่งคำตอบ ----------
  const submitAnswer = useCallback(() => {
    const text = answerText.trim();
    if (!text || sidRef.current === null) return;
    // ถ้า socket พร้อม ใช้ realtime ออกแบบเดิม
    if (socketRef.current?.connected) {
      socketRef.current.emit('submit_answer',
        { roomCode: code, studentId: sidRef.current, kind, text },
        (res: any) => {
          if (res?.ok) {
            setMyAnswers(prev => ({ ...prev, [kind]: res.answer }));
            setSavedFlash(true);
            setAnswerText('');
            setTimeout(() => setSavedFlash(false), 2000);
          } else {
            setError(res?.error || 'ส่งคำตอบไม่สำเร็จ');
            setTimeout(() => setError(''), 3000);
          }
        });
      return;
    }

    // หาก socket ตัดการเชื่อมต่อ ให้ลองใช้ REST fallback
    (async () => {
      try {
        const res = await fetch('/api/answers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomCode: code, studentId: sidRef.current, kind, text }),
        });
        const j = await res.json();
        if (j.ok) {
          setMyAnswers(prev => ({ ...prev, [kind]: j.answer }));
          setSavedFlash(true);
          setAnswerText('');
          setTimeout(() => setSavedFlash(false), 2000);
        } else {
          setError(j.error || 'ส่งคำตอบผ่าน REST ไม่สำเร็จ');
          setTimeout(() => setError(''), 3000);
        }
      } catch (e) {
        setError(String(e) || 'ส่งคำตอบล้มเหลว');
        setTimeout(() => setError(''), 3000);
      }
    })();
  }, [answerText, code, kind]);

  // ---------- วางรายการ (คลิกที่ต้นไม้ตรง ๆ) ----------
  const onCanvasClick = useCallback((point: { x: number; y: number }) => {
    if (action !== 'place') return;
    if (!selectedEmoji || sidRef.current === null) {
      setError('👇 กรุณาเลือก emoji จากถาดด้านล่างก่อน');
      setTimeout(() => setError(''), 2500);
      return;
    }
    if (hasPlacedCurrent) {
      setError('คุณได้วางรายการประเภทนี้แล้ว');
      setTimeout(() => setError(''), 2500);
      return;
    }
    const payload = {
      roomCode: code, studentId: sidRef.current, kind,
      answerId: myAnswers[kind]?.id ?? null, emoji: selectedEmoji,
      x: point.x, y: point.y, scale: 1, rotation: Math.random() * 30 - 15,
    };

    if (socketRef.current?.connected) {
      socketRef.current.emit('place_item', payload, (res: any) => {
        if (!res?.ok) {
          setError(res?.error || 'วางไม่สำเร็จ');
          setTimeout(() => setError(''), 2500);
        }
      });
      return;
    }

    // REST fallback
    (async () => {
      try {
        const res = await fetch('/api/place', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const j = await res.json();
        if (j.ok) {
          // อัปเดตสถานะการวางในฝั่ง client ทันที
          setPlacements(p => [...p, j.placement]);
        } else {
          setError(j.error || 'วางผ่าน REST ไม่สำเร็จ');
          setTimeout(() => setError(''), 2500);
        }
      } catch (e) {
        setError(String(e) || 'วางล้มเหลว');
        setTimeout(() => setError(''), 2500);
      }
    })();
  }, [action, code, kind, myAnswers, selectedEmoji, hasPlacedCurrent]);

  const kindEmoji = kind === 'leaf' ? '🍃' : kind === 'flower' ? '🌸' : '🍎';
  const phaseColor = kind === 'leaf' ? '#22c55e' : kind === 'flower' ? '#a855f7' : '#f59e0b';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header className="header">
        <div className="row">
          <span style={{ fontSize: 26 }}>🌳</span>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>ห้อง {code}</div>
            <div className="muted" style={{ fontSize: 12 }}>👤 {name}</div>
          </div>
        </div>
        <div className="row gap-8">
          <span className={`chip ${connected ? 'chip-green' : 'chip-rose'}`} style={{ fontSize: 12 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? 'var(--green-500)' : 'var(--rose-500)', display: 'inline-block' }} />
            {connected ? 'เชื่อมต่อ' : 'ตัดการเชื่อมต่อ'}
          </span>
          <span className="chip" style={{ background: `${phaseColor}18`, color: phaseColor, fontSize: 12 }}>
            {action === 'answer' ? '✍️' : '👆'} {action === 'answer' ? 'ตอบ' : 'วาง'} · {KIND_LABEL[kind]}
          </span>
        </div>
      </header>

      <main style={{
        flex: 1, display: 'grid', gap: 16, padding: 16,
        gridTemplateColumns: 'minmax(0, 1fr)', maxWidth: 600, margin: '0 auto', width: '100%',
      }}>
        {/* คำถาม + สถานะ */}
        <div className="card animate-fadeIn" style={{
          background: `linear-gradient(135deg, ${phaseColor}0a, ${phaseColor}05)`,
          borderColor: `${phaseColor}25`,
        }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div className="chip" style={{ background: `${phaseColor}18`, color: phaseColor, marginBottom: 8 }}>
                {kindEmoji} คำถาม{KIND_LABEL[kind]}
              </div>
              <p style={{ fontWeight: 600, fontSize: 16, marginTop: 4 }}>{questionFor(kind)}</p>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div className="muted" style={{ fontSize: 11 }}>ขั้นปัจจุบัน</div>
              <div style={{ fontWeight: 700, color: phaseColor, fontSize: 14 }}>
                {action === 'answer' ? '✍️ ตอบคำถาม' : '👆 วางบนต้นไม้'}
              </div>
            </div>
          </div>
        </div>

        {/* ต้นไม้ */}
        <div className="animate-fadeInUp">
          <TreeCanvas
            ref={canvasRef}
            placements={placements}
            onCanvasClick={onCanvasClick}
          />
          <p className="muted center" style={{ marginTop: 8, fontSize: 13 }}>
            🌿 ต้นไม้แห่งความหวัง — มี {placements.length} รายการจากเพื่อนร่วมชั้น
          </p>
        </div>

        {/* แผงควบคุม */}
        {error && (
          <div className="animate-scaleIn error-text" style={{ padding: '10px 14px', background: 'var(--rose-100)', borderRadius: 10 }}>
            ⚠️ {error}
          </div>
        )}

        {action === 'answer' ? (
          <div className="card animate-fadeInUp col gap-8">
            <textarea
              className="textarea"
              placeholder={`พิมพ์คำตอบของคุณเกี่ยวกับ${KIND_LABEL[kind]}...`}
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              autoFocus
              style={{ minHeight: 100, fontSize: 16 }}
            />
            <div className="row" style={{ justifyContent: 'space-between' }}>
              {hasAnsweredCurrent ? (
                <span className="chip chip-green animate-pulse">
                  {savedFlash ? '✅ บันทึกแล้ว!' : '✓ ตอบแล้ว — แก้ไขได้'}
                </span>
              ) : (
                <span className="muted" style={{ fontSize: 13 }}>✏️ รอคำตอบของคุณ</span>
              )}
              <button
                className="btn btn-primary"
                onClick={submitAnswer}
                disabled={!answerText.trim() || !connected}
              >
                ส่งคำตอบ ✨
              </button>
              {!connected && (
                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>
                  ⚠️ ยังไม่เชื่อมต่อกับเซิร์ฟเวอร์ — กรุณารีเฟรชหรือแจ้งผู้ดูแล
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="animate-fadeInUp col gap-8">
            <ItemTray
              kind={kind}
              selected={selectedEmoji}
              onSelect={(em) => setSelectedEmoji(cur => cur === em ? '' : em)}
              locked={hasPlacedCurrent}
              lockReason={hasPlacedCurrent ? 'คุณได้วางรายการประเภทนี้แล้ว' : undefined}
            />
            {selectedEmoji ? (
              <div className="card-flat" style={{
                textAlign: 'center', padding: 14,
                background: `${phaseColor}08`, borderColor: `${phaseColor}25`,
              }}>
                <p style={{ fontWeight: 600, fontSize: 14, color: phaseColor, marginBottom: 4 }}>
                  👆 ตอนนี้คลิกที่ต้นไม้เพื่อวาง {selectedEmoji}
                </p>
                <p className="muted" style={{ fontSize: 12 }}>วางได้หลายจุด — คลิกที่ใดก็ได้บนต้นไม้หรือบริเวณรอบข้าง</p>
              </div>
            ) : (
              <div className="card-flat muted center" style={{ padding: 14, fontSize: 14 }}>
                👆 เลือก {kindEmoji} จากถาดด้านบนก่อน แล้วคลิกบนต้นไม้เพื่อวาง
              </div>
            )}
          </div>
        )}

        {/* สถานะรออาจารย์ */}
        <div className="card-flat row" style={{ justifyContent: 'space-between' }}>
          <span className="muted" style={{ fontSize: 13 }}>
            {action === 'answer'
              ? hasAnsweredCurrent ? '✅ ตอบเสร็จแล้ว — รออาจารย์เปลี่ยนไปช่วงวาง' : '✏️ กรุณาตอบคำถาม'
              : hasPlacedCurrent ? '✅ คุณได้วางรายการประเภทนี้แล้ว' : '👆 คลิกที่ต้นไม้เพื่อวางได้ 1 ครั้งต่อประเภท'}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={() => router.push('/')}>← ออก</button>
        </div>
      </main>
    </div>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<div className="center" style={{ minHeight: '100vh' }}><div className="spinner" /></div>}>
      <PlayInner />
    </Suspense>
  );
}
