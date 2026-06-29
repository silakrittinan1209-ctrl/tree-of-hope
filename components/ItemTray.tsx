'use client';

import { EMOJIS, KIND_LABEL, type Kind } from '@/lib/types';

interface Props {
  kind: Kind;
  selected?: string;
  onSelect: (emoji: string) => void;
  locked?: boolean;
  lockReason?: string;
}

export default function ItemTray({ kind, selected, onSelect, locked, lockReason }: Props) {
  const emojis = EMOJIS[kind];
  const kindEmoji = kind === 'leaf' ? '🍃' : kind === 'flower' ? '🌸' : '🍎';
  const kindBg = kind === 'leaf' ? 'var(--green-50)' : kind === 'flower' ? 'var(--purple-100)' : 'var(--sky-50)';

  return (
    <div className="card-flat" style={{ padding: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <strong style={{ fontSize: 15 }}>
          {kindEmoji} เลือก{KIND_LABEL[kind]}ที่ชอบ
        </strong>
        {selected && (
          <span className="chip chip-green" style={{ fontSize: 12 }}>✓ พร้อมวาง</span>
        )}
      </div>

      {locked ? (
        <div className="muted center" style={{ padding: '12px 4px', fontSize: 14, background: kindBg, borderRadius: 10 }}>
          🔒 {lockReason || 'รออาจารย์เปิดให้วาง'}
        </div>
      ) : (
        <div className="row" style={{ flexWrap: 'wrap', gap: 10 }}>
          {emojis.map((em) => (
            <button
              key={em}
              onClick={() => onSelect(em)}
              className="no-select"
              style={{
                fontSize: 'clamp(20px, 5vw, 36px)',
                width: 'clamp(48px, 18vw, 64px)',
                height: 'clamp(48px, 18vw, 64px)',
                border: selected === em ? '2.5px solid var(--green-500)' : '2px solid var(--border)',
                borderRadius: 14,
                background: selected === em ? 'var(--green-50)' : '#fff',
                boxShadow: selected === em
                  ? '0 0 0 4px rgba(34,197,94,0.15), var(--shadow-sm)'
                  : 'var(--shadow-sm)',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                lineHeight: 1,
                transform: selected === em ? 'scale(1.08)' : 'scale(1)',
              }}
              onMouseEnter={(e) => { if (!selected || selected !== em) (e.target as HTMLElement).style.transform = 'scale(1.05)'; }}
              onMouseLeave={(e) => { if (selected !== em) (e.target as HTMLElement).style.transform = 'scale(1)'; }}
              title={`เลือก ${em}`}
            >
              {em}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
