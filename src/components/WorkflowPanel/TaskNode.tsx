import React, { useState } from 'react';
import { runTool } from '../../lib/api';

type Props = {
  id: string;
  data: { label?: string; tool?: string };
};

export default function TaskNode({ id, data }: Props) {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');

  async function onRun() {
    setStatus('running');
    try {
      const res = await runTool(data.tool || 'ingest');
      console.log(res);
      setStatus('success');
    } catch (e) {
      console.error(e);
      setStatus('error');
    }
  }

  return (
    <div style={{ padding: 8, borderRadius: 8, background: 'white', border: '1px solid #e5e7eb' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontWeight: 600 }}>{data.label || 'Task'}</div>
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={onRun} disabled={status === 'running'} style={{ padding: '6px 8px' }}>
            ▶
          </button>
        </div>
      </div>
      <div style={{ marginTop: 6, height: 6 }}>
        <div
          style={{
            height: 6,
            width: '100%',
            background: status === 'success' ? '#10b981' : status === 'error' ? '#ef4444' : '#e5e7eb',
            borderRadius: 6,
          }}
        />
      </div>
    </div>
  );
}
