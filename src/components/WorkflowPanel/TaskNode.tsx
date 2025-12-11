import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
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
      setTimeout(() => setStatus('idle'), 2200);
    } catch (e) {
      console.error(e);
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }

  const statusColor =
    status === 'success' ? '#10b981' : status === 'error' ? '#ef4444' : status === 'running' ? '#60a5fa' : '#cbd5e1';

  const labelText: string = data.label ?? '';

  function onDelete() {
    // emit a DOM event that the canvas can listen to and remove the node
    try {
      const ev = new CustomEvent('node:delete', { detail: { id } });
      window.dispatchEvent(ev);
    } catch (e) {
      // fallback for older browsers
      (window as any).nodeDelete = id;
    }
  }

  return (
    <div className="task-node" style={{ width: 260, borderRadius: 12, background: 'white', boxShadow: '0 8px 20px rgba(2,6,23,0.06)', border: '1px solid #eef2f7', overflow: 'hidden', fontFamily: 'Inter, system-ui, Arial' }}>
      {/* Left target handle */}
      <Handle type="target" position={Position.Left} style={{ top: 18, background: '#cbd5e1', width: 10, height: 10, borderRadius: 10 }} />

  <div className="task-node-header" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a', fontWeight: 700 }}>
          { (labelText?.charAt(0)?.toUpperCase && labelText.charAt(0).toUpperCase()) || 'T' }
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{data.label || 'Task'}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{data.tool || 'tool: —'}</div>
        </div>

        <div style={{ width: 10, height: 10, borderRadius: 10, background: statusColor }} />
        <button aria-label="Delete node" title="Delete node" onClick={onDelete} style={{ marginLeft: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M3 6h18" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M8 6v12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2V6" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M10 11v6" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M14 11v6" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div style={{ padding: 12, color: '#475569', fontSize: 13 }}>
        <div style={{ minHeight: 42 }}>{data.description || 'No description provided.'}</div>

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ background: '#f1f5f9', color: '#0f172a', padding: '4px 8px', borderRadius: 6, fontSize: 12 }}>{data.tool || 'ingest'}</div>
          </div>

          <div>
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
                fontWeight: 600,
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

      {/* Right source handle */}
      <Handle type="source" position={Position.Right} style={{ top: 18, background: '#2563eb', width: 10, height: 10, borderRadius: 10 }} />
    </div>
  );
}
