'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [qLeaf, setQLeaf] = useState('อะไรคือสิ่งที่ทำให้คุณมีความหวังในวันนี้?');
  const [qFlower, setQFlower] = useState('อะไรคือความฝันของคุณ?');
  const [qFruit, setQFruit] = useState('ผลลัพธ์ที่คุณอยากเก็บเกี่ยวในอนาคตคืออะไร?');
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState('');
  const [joinCode, setJoinCode] = useState('');

  async function handleCreate() {
    setCreating(true);
    setCreateErr('');
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q_leaf: qLeaf, q_flower: qFlower, q_fruit: qFruit }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      sessionStorage.setItem(`teacher_token_${data.code}`, data.teacherToken);
      router.push(`/teach/${data.code}?token=${data.teacherToken}`);
    } catch (e: any) {
      setCreateErr(e.message);
    } finally {
      setCreating(false);
    }
  }

  function handleJoin() {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    router.push(`/join?code=${code}`);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* พื้นหลังลวดลาย */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: -1, pointerEvents: 'none',
        background: 'linear-gradient(135deg, #ecfdf5 0%, #f0fdfa 30%, #fefce8 60%, #fff7ed 100%)',
      }} />

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
        {/* Hero */}
        <div className="animate-fadeIn" style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontSize: 80, lineHeight: 1, marginBottom: 12, filter: 'drop-shadow(0 4px 12px rgba(34,197,94,0.2))' }}>🌳</div>
          <h1 className="page-title" style={{ fontSize: 38, background: 'linear-gradient(135deg, #166534, #15803d, #0d9488)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            ต้นไม้แห่งความหวัง
          </h1>
          <p className="page-sub" style={{ marginTop: 8, maxWidth: 480, margin: '8px auto 0' }}>
            เกมระดมความคิดแบบเรียลไทม์ — ร่วมกันปลูกต้นไม้ด้วยคำตอบและความคิดของทุกคน
          </p>
        </div>

        {/* เลือกบทบาท */}
        <div className="card animate-fadeInUp" style={{ maxWidth: 520, width: '100%' }}>
          {!showCreate ? (
            <div className="col gap-16">
              {/* อาจารย์ */}
              <button className="btn btn-primary btn-lg" onClick={() => setShowCreate(true)} style={{ width: '100%' }}>
                <span style={{ fontSize: 24 }}>🧑‍🏫</span>
                ฉันเป็นอาจารย์ — สร้างห้องเรียน
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--muted)' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 13, fontWeight: 500 }}>หรือ</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              {/* ผู้เรียน */}
              <div className="col gap-8">
                <label className="field-label">ฉันเป็นผู้เรียน — กรอกรหัสห้องเพื่อเข้าร่วม</label>
                <div className="row">
                  <input
                    className="input"
                    placeholder="เช่น ABC123"
                    value={joinCode}
                    maxLength={6}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                    style={{ letterSpacing: 3, textTransform: 'uppercase', fontSize: 18, textAlign: 'center', fontWeight: 600, flex: 1 }}
                  />
                  <button className="btn btn-secondary btn-lg" onClick={handleJoin} disabled={joinCode.trim().length < 4}>
                    เข้าร่วม
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="col gap-16 animate-scaleIn">
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <h2 className="page-title" style={{ fontSize: 20 }}>✨ ตั้งคำถามสำหรับเกม</h2>
                <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>← ย้อน</button>
              </div>
              <p className="muted" style={{ fontSize: 14 }}>
                ผู้เรียนจะตอบคำถามทีละข้อตามลำดับ: <strong>ใบไม้ → ดอกไม้ → ผลไม้</strong> แล้ววางลงบนต้นไม้ทีละขั้น
              </p>

              <div className="col gap-12">
                <div>
                  <label className="field-label">🍃 คำถามใบไม้</label>
                  <textarea className="textarea" value={qLeaf} onChange={(e) => setQLeaf(e.target.value)} />
                </div>
                <div>
                  <label className="field-label">🌸 คำถามดอกไม้</label>
                  <textarea className="textarea" value={qFlower} onChange={(e) => setQFlower(e.target.value)} />
                </div>
                <div>
                  <label className="field-label">🍎 คำถามผลไม้</label>
                  <textarea className="textarea" value={qFruit} onChange={(e) => setQFruit(e.target.value)} />
                </div>
              </div>

              {createErr && <div className="error-text" style={{ padding: '10px 14px', background: 'var(--rose-100)', borderRadius: 10 }}>⚠️ {createErr}</div>}

              <button className="btn btn-primary btn-lg" onClick={handleCreate}
                disabled={creating || !qLeaf.trim() || !qFlower.trim() || !qFruit.trim()} style={{ width: '100%' }}>
                {creating ? (
                  <span className="row"><span className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} /> กำลังสร้างห้อง...</span>
                ) : '🌱 สร้างห้องและเริ่มต้น'}
              </button>
            </div>
          )}
        </div>

        <p className="muted" style={{ marginTop: 28, fontSize: 13, textAlign: 'center' }}>
          รองรับผู้เล่นพร้อมกันกว่า 100 คน • เชื่อมต่อแบบเรียลไทม์ผ่าน Socket.IO
        </p>
      </main>
    </div>
  );
}
