import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (files: FileList | null) => void;
};

export default function FileBrowserDialog({ open, onClose, onSelect }: Props) {
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origLeft: number; origTop: number } | null>(null);
  const [pos, setPos] = useState<{ left?: number; top?: number }>({});

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  // center modal initially - with slight delay to ensure DOM is ready
  useEffect(() => {
    if (!open) return;
    
    const calculatePosition = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const width = Math.min(680, Math.floor(w * 0.9));
      const estimatedHeight = 450;
      const left = Math.floor((w - width) / 2);
      const top = Math.max(40, Math.floor((h - estimatedHeight) / 2));
      setPos({ left, top });
    };
    
    // Small delay to ensure portal is rendered
    const timer = setTimeout(calculatePosition, 10);
    return () => clearTimeout(timer);
  }, [open]);

  function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (files) {
      const arr: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const f = files.item(i);
        if (f) arr.push(f.name);
      }
      setSelectedNames(arr);
      onSelect(files);
    } else {
      setSelectedNames([]);
      onSelect(null);
    }
  }

  if (!open) return null;

  // Drag handlers
  function onDragStart(e: React.PointerEvent) {
    const el = dialogRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origLeft: rect.left, origTop: rect.top };
    el.style.cursor = 'grabbing';
  }

  function onDragMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const d = dragRef.current;
    const intendedLeft = d.origLeft + (e.clientX - d.startX);
    const intendedTop = d.origTop + (e.clientY - d.startY);

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const el = dialogRef.current;
    const rect = el ? el.getBoundingClientRect() : { width: Math.min(680, Math.floor(vw * 0.9)), height: 450 };
    const margin = 12;
    const minLeft = margin - rect.width * 0.3;
    const maxLeft = vw - rect.width + rect.width * 0.3 - margin;
    const minTop = margin;
    const maxTop = vh - rect.height - margin;

    const left = Math.max(minLeft, Math.min(intendedLeft, maxLeft));
    const top = Math.max(minTop, Math.min(intendedTop, maxTop));

    setPos({ left, top });
  }

  function onDragEnd(e: React.PointerEvent) {
    try {
      (e.target as Element).releasePointerCapture(e.pointerId);
    } catch {}
    const el = dialogRef.current;
    if (el) el.style.cursor = '';
    dragRef.current = null;
  }

  const modal = (
    <div className="fixed inset-0 z-[9999]" style={{ position: 'fixed' }}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} style={{ position: 'absolute' }} />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal
        className="fixed z-[10000] max-h-[85vh] overflow-hidden rounded-2xl shadow-2xl border border-slate-700/50"
        style={{ 
          position: 'fixed',
          left: pos.left ?? '50%', 
          top: pos.top ?? '50%', 
          width: `min(90vw,680px)`,
          transform: (pos.left === undefined) ? 'translate(-50%, -50%)' : 'none',
          background: 'linear-gradient(to bottom, #f0285aff, #ca27a7ff)'
        }}
      >
        <div
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          className="grab-area cursor-grab flex items-center justify-between px-5 py-4 border-b border-slate-700/50"
          style={{ background: 'rgba(198, 208, 233, 0.8)' }}
        >
          <h3 className="text-lg font-semibold text-slate-100">Open Workspace Files</h3>
          <button 
            onClick={onClose} 
            aria-label="Close" 
            className="text-slate-400 hover:text-slate-200 text-2xl leading-none transition-colors"
          >
            ×
          </button>
        </div>

        <div className="p-6 overflow-auto max-h-[calc(85vh-80px)]">
          <label className="block text-sm font-medium text-slate-300 mb-3">Select files</label>
          <input 
            type="file" 
            multiple 
            onChange={handleFiles} 
            className="mb-4 w-full text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-200 file:cursor-pointer hover:file:bg-slate-600" 
          />

          <div className="text-sm text-slate-300 bg-slate-800/50 rounded-lg p-4 min-h-[100px]">
            {selectedNames.length === 0 ? (
              <div className="text-slate-500 italic">No files selected</div>
            ) : (
              <ul className="list-disc pl-5 space-y-1">
                {selectedNames.map((n) => (
                  <li key={n} className="text-slate-200">{n}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button 
              onClick={onClose} 
              className="px-5 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onClose();
              }}
              className="px-5 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 transition-colors font-medium shadow-lg shadow-indigo-500/30"
            >
              OK
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}