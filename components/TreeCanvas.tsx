'use client';

import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { Placement } from '@/lib/types';

export interface TreeCanvasHandle {
  pointToPercent: (clientX: number, clientY: number) => { x: number; y: number };
}

interface Props {
  placements: Placement[];
  renderItem?: (p: Placement) => React.ReactNode;
  draggingPreview?: { emoji: string; x: number; y: number } | null;
  highlightId?: number | null;
  onSelectPlacement?: (p: Placement) => void;
  onCanvasClick?: (point: { x: number; y: number }) => void;
}

const TreeCanvas = forwardRef<TreeCanvasHandle, Props>(function TreeCanvas(
  { placements, renderItem, draggingPreview, highlightId, onSelectPlacement, onCanvasClick },
  ref
) {
  const wrapRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    pointToPercent: (clientX, clientY) => {
      const el = wrapRef.current;
      if (!el) return { x: 50, y: 50 };
      const r = el.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(100, ((clientX - r.left) / r.width) * 100)),
        y: Math.max(0, Math.min(100, ((clientY - r.top) / r.height) * 100)),
      };
    },
  }));

  function handleCanvasClick(e: React.MouseEvent) {
    if (!onCanvasClick) return;
    // ไม่ส่ง event ถ้าคลิกที่รายการที่มีอยู่
    if ((e.target as HTMLElement).closest('[data-placement]')) return;
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    onCanvasClick({
      x: Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - r.top) / r.height) * 100)),
    });
  }

  return (
    <div
      ref={wrapRef}
      className="tree-canvas no-select touch-friendly"
      onClick={handleCanvasClick}
      role="application"
      aria-label="พื้นที่วางไอเท็ม"
      tabIndex={0}
      onKeyDown={(e) => {
        // allow keyboard users to add a centered point with Enter
        if (e.key === 'Enter' && onCanvasClick) {
          const el = wrapRef.current;
          if (!el) return;
          const r = el.getBoundingClientRect();
          onCanvasClick({ x: 50, y: 50 });
        }
      }}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '444 / 550',
        maxHeight: '80vh',
        touchAction: 'manipulation',
        backgroundImage: 'url(/tree-bg.webp)',
        backgroundSize: 'contain',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center',
        borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)',
        border: '2px solid var(--border)',
        cursor: onCanvasClick ? 'crosshair' : 'default',
        transition: 'box-shadow 0.3s ease',
      }}
    >
      {/* รายการที่วางแล้ว */}
      {placements.map((p) => (
        <div
          key={p.id}
          data-placement="true"
          onClick={(e) => { e.stopPropagation(); onSelectPlacement?.(p); }}
          className="animate-bounceIn"
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${p.y}%`,
            transform: `translate(-50%, -50%) rotate(${p.rotation}deg) scale(${p.scale})`,
            fontSize: 'clamp(20px, 5vw, 48px)',
            cursor: 'pointer',
            filter: highlightId === p.id
              ? 'drop-shadow(0 0 8px var(--amber-400)) drop-shadow(0 0 16px rgba(251,191,36,0.3))'
              : 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
            transition: 'filter 0.2s ease, transform 0.2s ease',
            zIndex: highlightId === p.id ? 10 : 2,
            lineHeight: 1,
          }}
        >
          {p.emoji}
          {renderItem?.(p)}
        </div>
      ))}

      {/* ตัวอย่างรายการที่ลาก */}
      {draggingPreview && (
        <div style={{
          position: 'absolute',
          left: `${draggingPreview.x}%`,
          top: `${draggingPreview.y}%`,
          transform: 'translate(-50%, -50%)',
            fontSize: 'clamp(26px, 6vw, 56px)',
          opacity: 0.75,
          pointerEvents: 'none',
          zIndex: 15,
          lineHeight: 1,
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.2))',
        }}>
          {draggingPreview.emoji}
        </div>
      )}
    </div>
  );
});

export default TreeCanvas;
