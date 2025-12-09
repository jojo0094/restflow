import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';

interface Props {
  id: string;
  initialDocked?: boolean;
  children?: React.ReactNode;
}

export default function Poppable({ id, initialDocked = true, children }: Props) {
  const [docked, setDocked] = useState(initialDocked);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 80, y: 80 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number } | null>(null);
  const elRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!dragging || !dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setPos((p) => ({ x: p.x + dx, y: p.y + dy }));
      dragRef.current = { startX: e.clientX, startY: e.clientY };
    }
    function onUp() {
      setDragging(false);
      dragRef.current = null;
    }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging]);

  function startDrag(e: React.PointerEvent) {
    setDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY };
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  }

  const overlay = document.getElementById('app-overlay');

  const node = (
    <div
      ref={elRef}
      style={{
        position: docked ? 'relative' : 'fixed',
        left: docked ? undefined : pos.x,
        top: docked ? undefined : pos.y,
        width: docked ? '100%' : 520,
        height: docked ? '100%' : 320,
        background: 'white',
        boxShadow: docked ? 'none' : '0 12px 40px rgba(0,0,0,0.12)',
        pointerEvents: docked ? 'auto' : 'all',
        zIndex: docked ? undefined : 10000,
      }}
    >
      <div style={{ display: 'flex', background: '#111827', color: 'white', alignItems: 'center' }} onPointerDown={docked ? undefined : startDrag}>
        <div style={{ padding: 8, cursor: docked ? 'default' : 'grab' }}>{id}</div>
        <div style={{ marginLeft: 'auto', padding: 8 }}>
          <button onClick={() => setDocked((d) => !d)}>{docked ? 'Undock' : 'Dock'}</button>
        </div>
      </div>
      <div style={{ padding: 12 }}>{children}</div>
    </div>
  );

  if (!docked && overlay) {
    return ReactDOM.createPortal(node, overlay);
  }

  return node;
}
