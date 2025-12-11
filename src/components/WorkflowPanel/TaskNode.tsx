import React, { useState } from 'react';
import { runTool } from '../../lib/api';

type Props = {
  id: string;
  data: { label?: string; tool?: string; description?: string };
};

export default function TaskNode({ id, data }: Props) {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle');

  async function onRun() {
    setStatus('running');
    try {
      await runTool(data.tool || 'ingest');
      setStatus('success');
      setTimeout(() => setStatus('idle'), 2500);
    } catch (e) {
      console.error(e);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }

  const statusColor = status === 'success' ? '#10b981' : status === 'error' ? '#ef4444' : status === 'running' ? '#60a5fa' : '#e5e7eb';

  return (
    <div className='Node-task' style={{ width: 240, borderRadius: 12, background: 'white', boxShadow: '0 6px 18px rgba(15,23,42,0.06)', border: '1px solid #f1f5f9', overflow: 'hidden' }}>
      <div className='Node-task-header' style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: '#fafafa' }}>
        <div style={{ width: 10, height: 10, borderRadius: 10, background: statusColor }} />
        <div style={{ fontWeight: 700, color: '#0f172a' }}>{data.label || 'Task'}</div>
      </div>

      <div style={{ padding: 12, color: '#475569', fontSize: 13 }}>
        <div style={{ minHeight: 36 }}>{data.description || 'No description provided.'}</div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <button
            onClick={onRun}
            disabled={status === 'running'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 12px',
              background: status === 'running' ? '#93c5fd' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: status === 'running' ? 'progress' : 'pointer',
            }}
          >
            {status === 'running' ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="white" strokeOpacity="0.24" strokeWidth="2" />
                <path d="M12 2 A10 10 0 0 1 22 12" stroke="white" strokeWidth="2" strokeLinecap="round" />
              </svg>
            ) : (
              'Run'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
