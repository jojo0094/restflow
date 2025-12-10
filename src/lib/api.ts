const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export async function health() {
  const res = await fetch(`${BASE}/`);
  return res.json();
}

export async function runWorkflow(payload: any) {
  const res = await fetch(`${BASE}/workflow/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to run workflow');
  return res.json();
}

export async function uploadFile(file: File) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${BASE}/upload`, { method: 'POST', body: fd });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
}

export async function listTools() {
  const res = await fetch(`${BASE}/tools`);
  if (!res.ok) throw new Error('Failed to list tools');
  return res.json();
}

export async function runTool(name: string, payload?: any) {
  const res = await fetch(`${BASE}/tools/${name}`, { method: 'POST', body: payload ? JSON.stringify(payload) : undefined, headers: payload ? { 'Content-Type': 'application/json' } : undefined });
  if (!res.ok) throw new Error('Tool run failed');
  return res.json();
}
