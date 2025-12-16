/**
 * API MODULE - Unified interface for data operations
 * 
 * ARCHITECTURE EVOLUTION:
 * ======================
 * OLD: api.ts made direct fetch() calls to FastAPI
 * NEW: api.ts delegates to an IDataEngine implementation
 * 
 * WHY THIS MATTERS:
 * - Components don't change (still call same functions)
 * - But now we can swap engines at runtime (remote vs WASM)
 * - Easy to add features like offline mode, caching, etc.
 * 
 * MIGRATION PATH:
 * - Keep old functions (runWorkflow, uploadFile, etc.) for backwards compatibility
 * - Add new engine-based functions (createWorkflowSession, executeNodeOperation)
 * - Gradually migrate components to use new functions
 * - Eventually remove old functions
 */

import type { IDataEngine, SessionId, Operation, OperationResult } from './engine';
import { RemoteDataEngine } from './engine';
import { engineReadyAtom } from '../atoms/engineAtom';
import { getDefaultStore } from 'jotai';

const BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

// Get the default Jotai store (allows setting atoms outside React components)
const store = getDefaultStore();

// ============================================================================
// ENGINE INITIALIZATION
// ============================================================================

/**
 * Global engine instance
 * 
 * WHY GLOBAL:
 * - All components need access to the same engine
 * - Avoids prop drilling (passing engine through 10 components)
 * - Can be swapped at runtime (remote -> WASM)
 * 
 * ALTERNATIVE APPROACH:
 * Could use React Context to provide engine to components.
 * Global is simpler for now, but Context is more "React-y".
 */
let engine: IDataEngine;

/**
 * Initialize the data engine
 * 
 * MUST BE CALLED ON APP STARTUP!
 * 
 * USAGE:
 * // In App.tsx or main.tsx
 * import { initEngine } from './lib/api';
 * 
 * function App() {
 *   useEffect(() => {
 *     initEngine('remote').catch(console.error);
 *   }, []);
 *   
 *   return <WorkflowCanvas />;
 * }
 * 
 * @param mode - 'remote' for FastAPI backend, 'wasm' for browser (future)
 */
export async function initEngine(mode: 'remote' | 'wasm' = 'remote'): Promise<void> {
  console.log(`[API] Initializing ${mode} engine...`);

  try {
    if (mode === 'remote') {
      const baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
      console.log(`[API] Using base URL: ${baseUrl}`);
      engine = new RemoteDataEngine(baseUrl);
    } else if (mode === 'wasm') {
      console.log('[API] WASM mode selected (not implemented)');
      throw new Error('WASM mode not yet implemented');
    } else {
      console.error(`[API] Unknown engine mode: ${mode}`);
      throw new Error(`Unknown engine mode: ${mode}`);
    }

    if (engine.init) {
      console.log('[API] Calling engine.init()...');
      await engine.init();
      console.log('[API] engine.init() completed successfully');
    } else {
      console.warn('[API] engine.init() method not found');
    }

    store.set(engineReadyAtom, true);
    console.log('[API] engineReadyAtom set to true');
  } catch (error) {
    console.error('[API] Error during engine initialization:', error);
    throw error;
  }

  console.log('[API] Engine initialized successfully');
}

/**
 * Get the current engine instance
 * 
 * THROWS if engine hasn't been initialized yet.
 * This helps catch bugs where we forget to call initEngine().
 */
function getEngine(): IDataEngine {
  if (!engine) {
    throw new Error('Engine not initialized. Call initEngine() first!');
  }
  return engine;
}

// ============================================================================
// NEW ENGINE-BASED API
// ============================================================================

/**
 * Create a new workflow execution session
 * 
 * WHEN TO CALL:
 * - User creates a new workflow
 * - User opens an existing workflow for editing
 * 
 * RETURNS:
 * SessionId that you'll pass to all subsequent operations
 * 
 * EXAMPLE:
 * const [sessionId, setSessionId] = useState<SessionId | null>(null);
 * 
 * useEffect(() => {
 *   createWorkflowSession().then(setSessionId);
 * }, []);
 */
export async function createWorkflowSession(): Promise<SessionId> {
  return getEngine().createSession();
}

/**
 * Destroy a workflow session (clean up temporary tables)
 * 
 * WHEN TO CALL:
 * - User closes workflow
 * - User switches to a different workflow
 * - Component unmounts
 * 
 * IMPORTANT:
 * Always call this! Otherwise temp tables accumulate and waste memory/disk.
 * 
 * EXAMPLE:
 * useEffect(() => {
 *   return () => {
 *     // Cleanup on unmount
 *     if (sessionId) {
 *       destroyWorkflowSession(sessionId).catch(console.error);
 *     }
 *   };
 * }, [sessionId]);
 */
export async function destroyWorkflowSession(sessionId: SessionId): Promise<void> {
  return getEngine().destroySession(sessionId);
}

/**
 * Execute a node operation
 * 
 * THIS IS THE MAIN WORKFLOW FUNCTION!
 * 
 * USAGE:
 * // In TaskNode.tsx
 * async function handleRun() {
 *   const operation = {
 *     type: 'filter',
 *     input: { kind: 'persistent', name: 'water_points' },
 *     filters: [
 *       { column: 'status', operator: 'equals', value: 'active' }
 *     ]
 *   };
 *   
 *   const result = await executeNodeOperation(sessionId, operation);
 *   // result.outputTable = { kind: 'temporary', name: 'temp_abc123', ... }
 *   // Store this in node data for next node to use
 * }
 */
export async function executeNodeOperation(
  sessionId: SessionId,
  operation: Operation
): Promise<OperationResult> {
  return getEngine().executeOperation(sessionId, operation);
}

/**
 * Commit a temporary table to make it permanent
 * 
 * WHEN TO CALL:
 * - User is satisfied with workflow results and clicks "Save Results"
 * - Want to keep an intermediate result for future workflows
 */
export async function commitWorkflowTable(
  sessionId: SessionId,
  tempTableName: string,
  finalTableName: string
): Promise<void> {
  return getEngine().commitTable(sessionId, tempTableName, finalTableName);
}

/**
 * Rollback session (discard all temporary tables)
 * 
 * WHEN TO CALL:
 * - User cancels workflow execution
 * - Workflow hits an error and needs cleanup
 */
export async function rollbackWorkflowSession(sessionId: SessionId): Promise<void> {
  return getEngine().rollbackSession(sessionId);
}

/**
 * List all tables in a session
 */
export async function listSessionTables(
  sessionId: SessionId,
  includeTemporary: boolean = true
) {
  return getEngine().listTables(sessionId, includeTemporary);
}

/**
 * Get schema for a table
 */
export async function getTableSchema(sessionId: SessionId, tableName: string) {
  return getEngine().getTableSchema(sessionId, tableName);
}

// ============================================================================
// LEGACY API (kept for backward compatibility)
// ============================================================================

/**
 * @deprecated Use createWorkflowSession() + executeNodeOperation() instead
 */

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

/**
 * Get columns for a workspace table (persistent or temporary).
 * This is different from getDatasetColumns which only works for predefined datasets.
 */
export async function getTableColumns(tableName: string) {
  const res = await fetch(`${BASE}/tools/tables/${encodeURIComponent(tableName)}/columns`);
  if (!res.ok) throw new Error(`Failed to get columns for table '${tableName}'`);
  return res.json();
}

/**
 * Get unique values for a column in a workspace table.
 * Similar to getDatasetColumnValues but works for actual workspace tables.
 */
export async function getTableColumnValues(tableName: string, columnName: string) {
  const res = await fetch(`${BASE}/tools/tables/${encodeURIComponent(tableName)}/columns/${encodeURIComponent(columnName)}/values`);
  if (!res.ok) throw new Error(`Failed to get values for column '${columnName}' in table '${tableName}'`);
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
