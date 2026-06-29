'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { getSocket } from '@/lib/socket-client';
import TreeCanvas from '@/components/TreeCanvas';
import PhaseController from '@/components/PhaseController';
import ProgressBoard from '@/components/ProgressBoard';
import type { Phase, Placement, ProgressData, Snapshot } from '@/lib/types';

function TeachInner() {
  const params = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const code = String(params.code).toUpperCase();
  const token = search.get('token') || '';

  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [phase, setPhase] = useState<Phase>('answer_leaf');
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [selected, setSelected] = useState<Placement | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [showStudents, setShowStudents] = useState(true);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<ReturnType<typeof getSocket> | null>(null);

  useEffect(() => {
    if (!token) { setError('ลิงก์อาจารย์ไม่ถูกต้อง'); return; }
    const socket = getSocket();
    socketRef.current = socket;

    const onConnect = () => {
      setConnected(true);
      socket.emit('join_room', { roomCode: code, role: 'teacher' }, (res: any) => {
        if (!res?.ok) { setError(res?.error || 'เปิดห้องไม่สำเร็จ'); return; }
        setSnapshot(res.snapshot);
        setPhase(res.snapshot?.room?.current_phase ?? 'answer_leaf');
        setPlacements(res.snapshot?.placements ?? []);
      });
    };

    const onDisconnect = () => setConnected(false);

    if (socket.connected) onConnect();
    else socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    const onItemPlaced = (d: any) => {
      setPlacements(p => [...p, d.placement]);
      if (d.answer) {
        setSnapshot((s) => {
          if (!s) return s;
          const exists = s.answers.find((a: any) => a.id === d.answer.id);
          if (exists) return s;
          // ensure the answer has a kind field matching placement
          return { ...s, answers: [...s.answers, { id: d.answer.id, student_id: d.answer.studentId, kind: d.placement.kind, text: d.answer.text }] };
        });
      }
    };
    const onItemRemoved = (d: any) => {
      setPlacements(p => p.filter(x => x.id !== d.placementId));
      setSelected(s => s?.id === d.placementId ? null : s);
    };
    const onPhaseChanged = (d: { phase: Phase }) => setPhase(d.phase);
    const onTreeReset = () => {
      setPlacements([]);
      setSelected(null);
      setSnapshot((s) => s ? { ...s, students: [], answers: [], placements: [] } : s);
    };
    const onRoomReset = (d: any) => {
      setSnapshot(d.snapshot);
      setPlacements(d.snapshot?.placements ?? []);
      setSelected(null);
    };
    const onProgress = (d: ProgressData) => setProgress(d);

    socket.on('connect', onConnect);
    socket.on('item_placed', onItemPlaced);
    socket.on('item_removed', onItemRemoved);
    socket.on('phase_changed', onPhaseChanged);
    socket.on('tree_reset', onTreeReset);
    socket.on('room_reset', onRoomReset);
    socket.on('progress', onProgress);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('item_placed', onItemPlaced);
      socket.off('item_removed', onItemRemoved);
      socket.off('phase_changed', onPhaseChanged);
      socket.off('tree_reset', onTreeReset);
      socket.off('room_reset', onRoomReset);
      socket.off('progress', onProgress);
    };
  }, [code, token]);

  const changePhase = useCallback((cmd: 'next' | 'prev' | Phase) => {
    socketRef.current?.emit('change_phase', { roomCode: code, token, direction: cmd });
  }, [code, token]);

  const resetTree = useCallback(() => {
    if (!connected) {
      setError('ยังไม่เชื่อมต่อกับเซิร์ฟเวอร์');
      return;
    }
    if (!confirm('ต้องการล้างรายการทั้งหมดบนต้นไม้หรือไม่? (คำตอบยังเก็บไว้)')) return;
    socketRef.current?.emit('reset_tree', { roomCode: code, token }, (res: any) => {
      if (!res?.ok) {
        setError(res?.error || 'ล้างต้นไม้ไม่สำเร็จ');
      } else {
        setError('ล้างต้นไม้เรียบร้อยแล้ว');
        setTimeout(() => setError(''), 2000);
      }
    });
  }, [code, token, connected]);

  const deletePlacement = useCallback((p: Placement) => {
    socketRef.current?.emit('delete_item', { roomCode: code, placementId: p.id });
    setSelected(null);
  }, [code]);

  const joinLink = typeof window !== 'undefined' ? `${window.location.origin}/join?code=${code}` : '';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header className="header" style={{ flexWrap: 'wrap' }}>
        <div className="row">
          <span style={{ fontSize: 26 }}>🌳</span>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>ห้องเรียน {code}</div>
            <div className="muted" style={{ fontSize: 12 }}>🎓 มุมมองอาจารย์</div>
          </div>
        </div>
        <div className="row gap-8">
          <button className="btn btn-secondary btn-sm" onClick={() => {
            navigator.clipboard?.writeText(joinLink);
            setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1500);
          }}>
            {linkCopied ? '✓ คัดลอกแล้ว' : '📋 ลิงก์'}
          </button>
          <button className="btn btn-secondary btn-sm" disabled={!connected} onClick={resetTree}>🗑️ ล้าง</button>
        </div>
      </header>

      {error && <div className="error-text" style={{ padding: 16 }}>{error}</div>}

      <main className="responsive-grid" style={{
        flex: 1, display: 'grid', gap: 16, padding: 16,
        maxWidth: 1400, margin: '0 auto', width: '100%',
      }}>
        {/* ต้นไม้ */}
        <section className="col gap-8" style={{ minWidth: 0 }}>
          <TreeCanvas
            placements={placements}
            highlightId={selected?.id}
            onSelectPlacement={(p) => setSelected(cur => cur?.id === p.id ? null : p)}
            renderItem={(p) => selected?.id === p.id ? (
              <button className="btn btn-danger btn-sm" style={{
                position: 'absolute', top: -32, left: '50%', transform: 'translateX(-50%)',
                fontSize: 12, padding: '4px 10px', zIndex: 20,
              }} onClick={(e) => { e.stopPropagation(); deletePlacement(p); }}>ลบ</button>
            ) : null}
          />
          {selected && (
            <div className="card-flat animate-scaleIn" style={{ fontSize: 14 }}>
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <strong>{selected.emoji} {selected.kind === 'leaf' ? 'ใบไม้' : selected.kind === 'flower' ? 'ดอกไม้' : 'ผลไม้'}</strong>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelected(null)}>✕</button>
              </div>
              <p className="muted" style={{ marginTop: 4, fontSize: 12 }}>
                ตำแหน่ง ({selected.x.toFixed(0)}%, {selected.y.toFixed(0)}%)
              </p>
              {(() => {
                const ans = snapshot?.answers.find(a => a.id === selected.answer_id);
                if (!ans) return null;
                return (
                  <div style={{ marginTop: 8, padding: 10, background: 'var(--green-50)', borderRadius: 8, border: '1px solid var(--green-200)' }}>
                    <div className="muted" style={{ fontSize: 11, marginBottom: 4 }}>💬 คำตอบที่ผูกไว้</div>
                    <div style={{ fontWeight: 500 }}>{ans.text}</div>
                  </div>
                );
              })()}
            </div>
          )}
          <p className="muted center" style={{ fontSize: 13 }}>
            🌳 {placements.length} รายการบนต้นไม้ — คลิกที่รายการเพื่อดูคำตอบ/ลบ
          </p>
        </section>

        {/* แผงควบคุม */}
        <aside className="col gap-16">
          <PhaseController phase={phase} onChange={changePhase} />

          {/* แชร์รหัส */}
          <div className="card animate-fadeIn" style={{
            textAlign: 'center', padding: 20,
            background: 'linear-gradient(135deg, var(--green-50), var(--green-100))',
            borderColor: 'var(--green-200)',
          }}>
            <div className="muted" style={{ fontSize: 13, marginBottom: 8, fontWeight: 500 }}>📲 ให้ผู้เรียนกรอกรหัสนี้</div>
            <div style={{
              fontSize: 40, fontWeight: 800, letterSpacing: 8, color: 'var(--green-700)',
              fontFamily: 'monospace', textShadow: '0 2px 4px rgba(22,163,74,0.15)',
            }}>
              {code}
            </div>
            <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={() => {
              navigator.clipboard?.writeText(code);
              setCopied(true); setTimeout(() => setCopied(false), 1500);
            }}>
              {copied ? '✓ คัดลอกแล้ว' : '📋 คัดลอกรหัส'}
            </button>
          </div>

          <ProgressBoard data={progress} />
        </aside>
      </main>
    </div>
  );
}

export default function TeachPage() {
  return (
    <Suspense fallback={<div className="center" style={{ minHeight: '100vh' }}><div className="spinner" /></div>}>
      <TeachInner />
    </Suspense>
  );
}
