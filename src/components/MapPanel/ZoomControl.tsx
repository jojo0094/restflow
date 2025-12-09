import React, { useState } from 'react';

export default function ZoomControl() {
  const [zoom, setZoom] = useState(100);
  return (
    <div style={{ position: 'absolute', right: 12, bottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <button onClick={() => setZoom((z) => z + 10)} style={{ width: 36, height: 36, borderRadius: 6 }}>+</button>
      <div style={{ width: 36, height: 36, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>{zoom}%</div>
      <button onClick={() => setZoom((z) => Math.max(10, z - 10))} style={{ width: 36, height: 36, borderRadius: 6 }}>−</button>
    </div>
  );
}
