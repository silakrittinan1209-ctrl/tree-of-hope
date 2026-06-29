'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function JoinInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(params.get('code')?.toUpperCase() ?? '');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [roomInfo, setRoomInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancel = false;
    if (code.length >= 4) {
      setLoading(true);
      fetch(`/api/rooms?code=${code}`)
        .then(r => r.json())
        .then(d => {
          if (cancel) return;
          if (d.ok) { setRoomInfo(d.room); setErr(''); }
          else { setRoomInfo(null); setErr('ไม่พบห้องที่มีรหัสนี้'); }
        })
        .catch(() => setErr('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้'))
        .finally(() => setLoading(false));
    } else { setRoomInfo(null); setErr(''); }
    return () => { cancel = true; };
  }, [code]);

  function handleEnter() {
    if (!roomInfo || !name.trim()) return;
    sessionStorage.setItem('player_name', name.trim());
    router.push(`/play/${code}?name=${encodeURIComponent(name.trim())}`);
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div className="card animate-fadeInUp" style={{ maxWidth: 440, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 8 }}>🌿</div>
          <h1 className="page-title" style={{ fontSize: 24 }}>เข้าร่วมเกม</h1>
        </div>

        <div className="col gap-16">
          <div>
            <label className="field-label">รหัสห้อง</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                value={code}
                maxLength={6}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="เช่น ABC123"
                style={{ letterSpacing: 4, textTransform: 'uppercase', fontSize: 20, textAlign: 'center', fontWeight: 700, fontFamily: 'monospace, monospace' }}
              />
              {loading && <div className="spinner" style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', width: 20, height: 20, borderWidth: 2 }} />}
            </div>
          </div>

          {roomInfo && (
            <div className="animate-scaleIn">
              <div className="chip chip-green" style={{ marginBottom: 12 }}>✓ พบห้อง</div>
              <div>
                <label className="field-label">ชื่อของคุณ</label>
                <input
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleEnter()}
                  placeholder="เช่น น้องบีม ม.4/3"
                  autoFocus
                />
              </div>
              <button className="btn btn-primary btn-lg" onClick={handleEnter}
                disabled={!name.trim()} style={{ width: '100%', marginTop: 16 }}>
                🎮 เข้าร่วมเลย
              </button>
            </div>
          )}

          {err && <div className="error-text" style={{ padding: '10px 14px', background: 'var(--rose-100)', borderRadius: 10 }}>⚠️ {err}</div>}

          <button className="btn btn-ghost" onClick={() => router.push('/')} style={{ alignSelf: 'center' }}>
            ← กลับหน้าแรก
          </button>
        </div>
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={<div className="center" style={{ minHeight: '100vh' }}><div className="spinner" /></div>}>
      <JoinInner />
    </Suspense>
  );
}
