'use client';

import type { ProgressData } from '@/lib/types';

interface Props {
  data: ProgressData | null;
}

export default function ProgressBoard({ data }: Props) {
  if (!data) {
    return (
      <div className="card-flat center muted" style={{ padding: 20 }}>
        <div className="spinner" style={{ width: 24, height: 24 }} />
        <span style={{ marginLeft: 8 }}>กำลังโหลด...</span>
      </div>
    );
  }

  const total = data.totalStudents;

  return (
    <div className="card-flat" style={{ padding: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <strong style={{ fontSize: 15 }}>📊 ความคืบหน้า</strong>
        <span className="chip chip-green">นักเรียน {total} คน</span>
      </div>

      {/* สรุปยอด */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
        <StatBox emoji="🍃" label="ใบไม้" answered={data.answered.leaf} placed={data.placed.leaf} total={total} color="#22c55e" />
        <StatBox emoji="🌸" label="ดอกไม้" answered={data.answered.flower} placed={data.placed.flower} total={total} color="#a855f7" />
        <StatBox emoji="🍎" label="ผลไม้" answered={data.answered.fruit} placed={data.placed.fruit} total={total} color="#f59e0b" />
      </div>

      {/* ตาราง */}
      <div style={{ overflowX: 'auto', maxHeight: 260, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead style={{ position: 'sticky', top: 0, background: '#fff', zIndex: 2 }}>
            <tr style={{ borderBottom: '2px solid var(--border)' }}>
              <th style={{ padding: '8px 6px', textAlign: 'left' }}>ชื่อ</th>
              <th style={{ padding: '8px 6px', textAlign: 'left' }}>🍃</th>
              <th style={{ padding: '8px 6px', textAlign: 'left' }}>🌸</th>
              <th style={{ padding: '8px 6px', textAlign: 'left' }}>🍎</th>
              <th style={{ padding: '8px 6px', textAlign: 'center' }}>วาง</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 && (
              <tr><td colSpan={5} className="muted center" style={{ padding: 16 }}>ยังไม่มีนักเรียนเข้าร่วม</td></tr>
            )}
            {data.rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '8px 6px', fontWeight: 600 }}>{r.name}</td>
                <td style={{ padding: '8px 6px' }}><CellText text={r.leafAnswer} /></td>
                <td style={{ padding: '8px 6px' }}><CellText text={r.flowerAnswer} /></td>
                <td style={{ padding: '8px 6px' }}><CellText text={r.fruitAnswer} /></td>
                <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 24, height: 24, borderRadius: 6,
                    background: r.placedCount > 0 ? 'var(--green-100)' : '#f1f5f9',
                    color: r.placedCount > 0 ? 'var(--green-700)' : 'var(--muted)',
                    fontWeight: 700, fontSize: 12,
                  }}>{r.placedCount}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatBox({ emoji, label, answered, placed, total, color }: {
  emoji: string; label: string; answered: number; placed: number; total: number; color: string;
}) {
  const pct = total > 0 ? Math.round((answered / total) * 100) : 0;
  return (
    <div style={{
      background: `${color}08`, border: `1.5px solid ${color}25`,
      borderRadius: 12, padding: 12, textAlign: 'center',
    }}>
      <div style={{ fontSize: 28 }}>{emoji}</div>
      <div style={{ fontWeight: 700, fontSize: 14, marginTop: 2 }}>{label}</div>
      <div style={{ margin: '6px 0', height: 4, borderRadius: 2, background: '#e5e7eb', overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 2, background: color, width: `${pct}%`, transition: 'width 0.4s ease' }} />
      </div>
      <div className="muted" style={{ fontSize: 11 }}>ตอบ {answered}/{total} · วาง {placed}</div>
    </div>
  );
}

function CellText({ text }: { text: string }) {
  if (!text) return <span className="muted">—</span>;
  if (text.length > 35) return <span title={text}>{text.slice(0, 35)}…</span>;
  return <span>{text}</span>;
}
