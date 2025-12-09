import React from 'react';

interface Props {
  open: boolean;
  onToggle: () => void;
}

export default function RightBar({ open, onToggle }: Props) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 8, display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={onToggle} style={{ padding: '6px 8px' }}>{open ? 'Close' : 'Open'}</button>
      </div>
      <div style={{ padding: 12, color: '#6b7280' }}>{open ? 'Right panel content' : 'Minimized'}</div>
    </div>
  );
}
