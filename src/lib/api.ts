const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export async function health() {
  const res = await fetch(`${BASE}/`);
  return res.json();
}

// ==================== Legacy endpoints ====================

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

export async function runToolDry(name: string, payload?: any) {
  const body = Object.assign({}, payload || {}, { dry_run: true });
  const res = await fetch(`${BASE}/tools/${name}`, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
  if (!res.ok) throw new Error('Tool dry run failed');
  return res.json();
}

// ==================== New workflow API ====================

export async function getNodeTypes() {
  const res = await fetch(`${BASE}/api/nodes/types`);
  if (!res.ok) throw new Error('Failed to get node types');
  return res.json();
}

export async function listDatasets() {
  const res = await fetch(`${BASE}/tools/datasets`);
  if (!res.ok) throw new Error('Failed to list datasets');
  return res.json();
}

export async function getDatasetColumns(name: string) {
  const res = await fetch(`${BASE}/tools/datasets/${encodeURIComponent(name)}/columns`);
  if (!res.ok) throw new Error('Failed to get dataset columns');
  return res.json();
}

export async function getDatasetColumnValues(name: string, col: string) {
  const res = await fetch(`${BASE}/tools/datasets/${encodeURIComponent(name)}/columns/${encodeURIComponent(col)}/values`);
  if (!res.ok) throw new Error('Failed to get column values');
  return res.json();
}

export async function listDestinationTables() {
  const res = await fetch(`${BASE}/tools/destination-tables`);
  if (!res.ok) throw new Error('Failed to list destination tables');
  return res.json();
}

export async function createWorkflow(workflow: any) {
  const res = await fetch(`${BASE}/api/workflows`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  });
  if (!res.ok) throw new Error('Failed to create workflow');
  return res.json();
}

export async function getWorkflow(id: number) {
  const res = await fetch(`${BASE}/api/workflows/${id}`);
  if (!res.ok) throw new Error('Failed to get workflow');
  return res.json();
}

export async function updateWorkflow(id: number, workflow: any) {
  const res = await fetch(`${BASE}/api/workflows/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  });
  if (!res.ok) throw new Error('Failed to update workflow');
  return res.json();
}

export async function deleteWorkflow(id: number) {
  const res = await fetch(`${BASE}/api/workflows/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete workflow');
}

export async function executeWorkflow(workflowId: number, inputData?: any) {
  const res = await fetch(`${BASE}/api/workflows/${workflowId}/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workflow_id: workflowId, input_data: inputData }),
  });
  if (!res.ok) throw new Error('Failed to execute workflow');
  return res.json();
}

export async function getExecutionStatus(executionId: number) {
  const res = await fetch(`${BASE}/api/executions/${executionId}`);
  if (!res.ok) throw new Error('Failed to get execution status');
  return res.json();
}
