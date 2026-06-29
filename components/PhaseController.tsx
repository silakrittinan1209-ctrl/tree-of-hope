'use client';

import { PHASES, PHASE_LABEL, type Phase } from '@/lib/types';

interface Props {
  phase: Phase;
  onChange: (cmd: 'next' | 'prev' | Phase) => void;
  disabled?: boolean;
}

export default function PhaseController({ phase, onChange, disabled }: Props) {
  const idx = PHASES.indexOf(phase);

  const phaseColors: Record<Phase, string> = {
    answer_leaf: '#22c55e', place_leaf: '#16a34a',
    answer_flower: '#a855f7', place_flower: '#9333ea',
    answer_fruit: '#f59e0b', place_fruit: '#d97706',
  };

  return (
    <div className="card-flat" style={{ padding: 16 }}>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <strong style={{ fontSize: 15 }}>🎯 ขั้นตอนปัจจุบัน</strong>
        <span className="chip" style={{ background: `${phaseColors[phase]}18`, color: phaseColors[phase] }}>
          {PHASE_LABEL[phase]}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 6, borderRadius: 3, background: 'var(--border)', marginBottom: 14, overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: 3,
          background: `linear-gradient(90deg, ${phaseColors[PHASES[idx]]}, ${phaseColors[PHASES[Math.min(idx + 1, PHASES.length - 1)]]})`,
          width: `${((idx + 1) / PHASES.length) * 100}%`,
          transition: 'width 0.4s ease',
        }} />
      </div>

      {/* ลำดับขั้น */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {PHASES.map((p, i) => {
          const done = i < idx;
          const current = i === idx;
          const c = phaseColors[p];
          return (
            <button
              key={p}
              onClick={() => onChange(p)}
              disabled={disabled}
              style={{
                flex: 1, minWidth: 72, padding: '10px 6px', borderRadius: 10,
                border: `1.5px solid ${current ? c : done ? c + '60' : 'var(--border)'}`,
                background: current ? c : done ? c + '12' : '#fff',
                color: current ? '#fff' : done ? c : 'var(--muted)',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                opacity: disabled ? 0.6 : 1,
                transition: 'all 0.2s ease',
                transform: current ? 'scale(1.03)' : 'scale(1)',
              }}
              title={PHASE_LABEL[p]}
            >
              {done ? '✓ ' : ''}{PHASE_LABEL[p]}
            </button>
          );
        })}
      </div>

      {/* ปุ่ม */}
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => onChange('prev')}
          disabled={disabled || idx <= 0}>← ย้อน</button>
        <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>
          ขั้น {idx + 1} / {PHASES.length}
        </span>
        <button className="btn btn-primary btn-sm" onClick={() => onChange('next')}
          disabled={disabled || idx >= PHASES.length - 1}>ถัดไป →</button>
      </div>
    </div>
  );
}
