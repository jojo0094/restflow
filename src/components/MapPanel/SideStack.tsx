import React, { useEffect, useRef, useState } from 'react';

interface Props {
        name: string;
        open: boolean;
        onToggle: () => void;
        children?: React.ReactNode;
        initialWidth?: number;
        side?: 'left' | 'right';
}

export default function SideStack({ name, open, onToggle, children, initialWidth = 220, side = 'left' }: Props) {
        const [width, setWidth] = useState(open ? initialWidth : 40);
        const resizingRef = useRef(false);
        const rootRef = useRef<HTMLDivElement | null>(null);

        useEffect(() => {
                setWidth(open ? Math.max(80, width) : 40);
                // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [open]);

        useEffect(() => {
                                function onPointerMove(e: PointerEvent) {
                                        if (!resizingRef.current || !rootRef.current) return;
                                        const rect = rootRef.current.getBoundingClientRect();
                                        let newWidth = width;
                                        if (side === 'left') {
                                                newWidth = Math.max(60, e.clientX - rect.left);
                                        } else {
                                                // right-side panel: calculate width from right edge
                                                const parentRect = rootRef.current.parentElement?.getBoundingClientRect();
                                                if (parentRect) {
                                                        newWidth = Math.max(60, parentRect.right - e.clientX);
                                                }
                                        }
                                        setWidth(Math.min(520, newWidth));
                                }

                function onPointerUp() {
                        resizingRef.current = false;
                        rootRef.current?.releasePointerCapture?.(0 as any);
                }

                window.addEventListener('pointermove', onPointerMove);
                window.addEventListener('pointerup', onPointerUp);
                return () => {
                        window.removeEventListener('pointermove', onPointerMove);
                        window.removeEventListener('pointerup', onPointerUp);
                };
        }, []);

                function startResize(e: React.PointerEvent) {
                        resizingRef.current = true;
                        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                }

        return (
                <div ref={rootRef} className={`left-stack left-stack-${name}`} style={{ width, transition: resizingRef.current ? 'none' : 'width 160ms ease', overflow: 'hidden', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center' }}>
                                        <button onClick={onToggle} aria-label={`Toggle ${name}`} style={{ width: 40, height: 40, background: '#111827', color: 'white', border: 'none' }}>{name}</button>
                                        {/* spacer when open */}
                                        {open && <div style={{ paddingLeft: 8, color: '#374151', fontWeight: 600 }}>Panel {name}</div>}
                                </div>

                                {open && <div style={{ padding: 8 }}>{children}</div>}
                        </div>

                        {/* resize handle on the right edge */}
                                                {open && (
                                                        <div
                                                                onPointerDown={startResize}
                                                                style={side === 'left' ? { position: 'absolute', right: 0, top: 0, bottom: 0, width: 12, cursor: 'col-resize', zIndex: 30 } : { position: 'absolute', left: 0, top: 0, bottom: 0, width: 12, cursor: 'col-resize', zIndex: 30 }}
                                                                aria-hidden
                                                        />
                                                )}
                </div>
        );
}
