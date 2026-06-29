'use client';

import { useCallback, useRef, useState } from 'react';
import type { TreeCanvasHandle } from './TreeCanvas';

export interface DragState {
  emoji: string;
  x: number; // เปอร์เซ็นต์ 0-100
  y: number;
}

interface Options {
  canvasRef: React.RefObject<TreeCanvasHandle>;
  onPlace: (point: { x: number; y: number }) => void;
}

/**
 * Hook จัดการการลากจากถาดไปยังต้นไม้
 * - ใช้ pointer events รองรับทั้งเมาส์และจอสัมผัส
 * - ทำงานบนระดับ document (window) เพื่อให้ลากออกนอกขอบถาดได้
 */
export function useDragPlace({ canvasRef, onPlace }: Options) {
  const [dragging, setDragging] = useState<DragState | null>(null);
  const emojiRef = useRef<string | null>(null);
  const activePointer = useRef<number | null>(null);

  const startDrag = useCallback(
    (emoji: string, ev: React.PointerEvent) => {
      // กันการลากซ้อนกันหลายนิ้ว
      if (activePointer.current !== null) return;
      emojiRef.current = emoji;
      activePointer.current = ev.pointerId;
      const pt = canvasRef.current?.pointToPercent(ev.clientX, ev.clientY);
      setDragging({ emoji, x: pt?.x ?? 50, y: pt?.y ?? 50 });

      // capture เพื่อให้รับ pointermove แม้อยู่นอก element
      (ev.target as Element).setPointerCapture?.(ev.pointerId);
    },
    [canvasRef]
  );

  const moveDrag = useCallback(
    (ev: React.PointerEvent) => {
      if (activePointer.current !== ev.pointerId) return;
      const pt = canvasRef.current?.pointToPercent(ev.clientX, ev.clientY);
      if (pt) {
        setDragging((d) => (d ? { ...d, x: pt.x, y: pt.y } : d));
      }
    },
    [canvasRef]
  );

  const endDrag = useCallback(
    (ev: React.PointerEvent) => {
      if (activePointer.current !== ev.pointerId) return;
      const pt = canvasRef.current?.pointToPercent(ev.clientX, ev.clientY);
      activePointer.current = null;
      const emoji = emojiRef.current;
      emojiRef.current = null;
      setDragging(null);

      if (pt && emoji) {
        onPlace({ x: pt.x, y: pt.y });
      }
    },
    [canvasRef, onPlace]
  );

  const cancelDrag = useCallback(() => {
    activePointer.current = null;
    emojiRef.current = null;
    setDragging(null);
  }, []);

  return { dragging, startDrag, moveDrag, endDrag, cancelDrag };
}
