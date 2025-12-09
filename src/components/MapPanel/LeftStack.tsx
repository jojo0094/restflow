import React from 'react';

interface Props {
        name: string;
        open: boolean;
        onToggle: () => void;
        children?: React.ReactNode;
}

export default function SideStack({ name, open, onToggle, children }: Props) {
        return (
                <div className={`left-stack left-stack-${name}`} style={{ width: open ? 220 : 40, transition: 'width 160ms ease', overflow: 'hidden', borderRight: '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                                <button onClick={onToggle} aria-label={`Toggle ${name}`} style={{ width: 40, height: 40, background: '#111827', color: 'white', border: 'none' }}>{name}</button>
                                {open && <div style={{ padding: 8 }}>{children}</div>}
                        </div>
                </div>
        );
}
