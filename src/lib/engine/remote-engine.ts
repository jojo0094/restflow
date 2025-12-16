/**
 * REMOTE DATA ENGINE - FastAPI Backend Implementation
 * 
 * This class implements IDataEngine by making HTTP requests to our FastAPI backend.
 * It translates our abstract Operations into concrete API calls.
 * 
 * ARCHITECTURE NOTE:
 * This is the "Adapter" in the Adapter Pattern - it adapts our generic interface
 * to the specific API of our FastAPI backend.
 * 
 * BEGINNERS: HTTP Request Flow
 * ==============================
 * 1. Frontend calls: engine.createSession()
 * 2. RemoteEngine translates to: POST http://localhost:8000/api/sessions
 * 3. Backend creates session, returns { session_id: "abc-123" }
 * 4. RemoteEngine returns "abc-123" to frontend
 * 
 * Same pattern for all methods!
 */

import type {
  IDataEngine,
  SessionId,
  TableInfo,
  Schema,
  OperationResult,
} from './types';
import type { Operation } from './operations';

/**
 * RemoteDataEngine - Talks to FastAPI backend via HTTP
 */
export class RemoteDataEngine implements IDataEngine {
  private baseUrl: string;

  /**
   * Constructor
   * @param baseUrl - Base URL of FastAPI server (e.g., "http://localhost:8000")
   * 
   * USAGE:
   * const engine = new RemoteDataEngine('http://localhost:8000');
   */
  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  /**
   * Initialize the engine (optional for remote, but we check server health)
   */
  async init(): Promise<void> {
    try {
      const res = await fetch(`${this.baseUrl}/`);
      if (!res.ok) {
        throw new Error(`Server health check failed: ${res.status}`);
      }
      console.log('[RemoteEngine] Connected to backend successfully');
    } catch (error) {
      console.error('[RemoteEngine] Failed to connect to backend:', error);
      throw new Error('Cannot connect to backend server. Is it running?');
    }
  }

  // --------------------------------------------------------------------------
  // SESSION MANAGEMENT
  // --------------------------------------------------------------------------

  /**
   * Create a new session on the backend
   * 
   * API CALL: POST /api/sessions
   * Response: { "session_id": "uuid-string" }
   */
  async createSession(): Promise<SessionId> {
    const res = await fetch(`${this.baseUrl}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) {
      throw new Error(`Failed to create session: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    console.log('[RemoteEngine] Session created:', data.session_id);
    return data.session_id;
  }

  /**
   * Destroy a session (clean up backend resources)
   * 
   * API CALL: DELETE /api/sessions/{sessionId}
   */
  async destroySession(sessionId: SessionId): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/sessions/${sessionId}`, {
      method: 'DELETE'
    });

    if (!res.ok) {
      console.warn(`[RemoteEngine] Failed to destroy session ${sessionId}`);
    } else {
      console.log('[RemoteEngine] Session destroyed:', sessionId);
    }
  }

  // --------------------------------------------------------------------------
  // TABLE INTROSPECTION
  // --------------------------------------------------------------------------

  /**
   * List all tables in a session
   * 
   * API CALL: GET /api/sessions/{sessionId}/tables?includeTemporary=true
   */
  async listTables(
    sessionId: SessionId,
    includeTemporary: boolean = true
  ): Promise<TableInfo[]> {
    const params = new URLSearchParams({
      includeTemporary: String(includeTemporary)
    });

    const res = await fetch(
      `${this.baseUrl}/api/sessions/${sessionId}/tables?${params}`
    );

    if (!res.ok) {
      throw new Error(`Failed to list tables: ${res.status}`);
    }

    const data = await res.json();
    return data.tables;
  }

  /**
   * Check if a table exists
   * 
   * API CALL: HEAD /api/sessions/{sessionId}/tables/{tableName}
   * (HEAD request returns only status code, no body - efficient!)
   */
  async tableExists(sessionId: SessionId, tableName: string): Promise<boolean> {
    const res = await fetch(
      `${this.baseUrl}/api/sessions/${sessionId}/tables/${encodeURIComponent(tableName)}`,
      { method: 'HEAD' }
    );

    return res.ok; // 200 = exists, 404 = doesn't exist
  }

  /**
   * Get table schema (column names and types)
   * 
   * API CALL: GET /api/sessions/{sessionId}/tables/{tableName}/schema
   */
  async getTableSchema(sessionId: SessionId, tableName: string): Promise<Schema> {
    const res = await fetch(
      `${this.baseUrl}/api/sessions/${sessionId}/tables/${encodeURIComponent(tableName)}/schema`
    );

    if (!res.ok) {
      throw new Error(`Failed to get schema for ${tableName}: ${res.status}`);
    }

    const data = await res.json();
    return data.schema;
  }

  // --------------------------------------------------------------------------
  // CORE OPERATION EXECUTION
  // --------------------------------------------------------------------------

  /**
   * Execute a data operation
   * 
   * THIS IS THE HEART OF THE ENGINE!
   * 
   * HOW IT WORKS:
   * 1. Take the Operation object (plain JavaScript object)
   * 2. Send it to backend as JSON
   * 3. Backend parses operation type and executes appropriate logic
   * 4. Backend returns OperationResult with output table reference
   * 
   * API CALL: POST /api/sessions/{sessionId}/execute
   * Request body: { "operation": {...} }
   * Response: { "success": true, "outputTable": {...}, "rowCount": 123 }
   * 
   * EXAMPLE FLOW:
   * ```
   * const filterOp = {
   *   type: 'filter',
   *   input: { kind: 'persistent', name: 'water_points' },
   *   filters: [{ column: 'status', operator: 'equals', value: 'active' }]
   * };
   * 
   * const result = await engine.executeOperation(sessionId, filterOp);
   * // result.outputTable = { kind: 'temporary', name: 'temp_xyz789', sessionId }
   * // result.rowCount = 42
   * ```
   */
  async executeOperation(
    sessionId: SessionId,
    operation: Operation
  ): Promise<OperationResult> {
    console.log(`[RemoteEngine] Executing ${operation.type} operation`, operation);

    const res = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation })
    });

    if (!res.ok) {
      // Try to get error details from response
      let errorMsg = `Operation failed: ${res.status}`;
      try {
        const errorData = await res.json();
        errorMsg += ` - ${errorData.detail || errorData.error || 'Unknown error'}`;
      } catch {
        // If error response isn't JSON, use status text
        errorMsg += ` - ${res.statusText}`;
      }
      throw new Error(errorMsg);
    }

    const result = await res.json();
    console.log(`[RemoteEngine] ${operation.type} completed:`, result);
    return result;
  }

  // --------------------------------------------------------------------------
  // MATERIALIZATION
  // --------------------------------------------------------------------------

  /**
   * Commit a temporary table to make it permanent
   * 
   * API CALL: POST /api/sessions/{sessionId}/commit
   * Request body: { "tempTable": "temp_abc123", "finalTable": "my_results" }
   * 
   * WHAT HAPPENS ON BACKEND:
   * 1. Backend runs SQL: ALTER TABLE temp_abc123 RENAME TO my_results;
   * 2. Marks table as permanent (no longer cleaned up on session end)
   * 3. Returns success
   */
  async commitTable(
    sessionId: SessionId,
    tempTableName: string,
    finalTableName: string
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/commit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tempTable: tempTableName,
        finalTable: finalTableName
      })
    });

    if (!res.ok) {
      throw new Error(`Failed to commit table: ${res.status}`);
    }

    console.log(`[RemoteEngine] Committed ${tempTableName} -> ${finalTableName}`);
  }

  /**
   * Rollback session (delete all temporary tables)
   * 
   * API CALL: POST /api/sessions/{sessionId}/rollback
   * 
   * IMPORTANT:
   * This is automatically called when session is destroyed, but you can also
   * call it explicitly if user cancels workflow.
   */
  async rollbackSession(sessionId: SessionId): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/sessions/${sessionId}/rollback`, {
      method: 'POST'
    });

    if (!res.ok) {
      console.warn(`[RemoteEngine] Rollback failed for session ${sessionId}`);
    } else {
      console.log(`[RemoteEngine] Session rolled back: ${sessionId}`);
    }
  }

  // --------------------------------------------------------------------------
  // HELPER METHODS (for backwards compatibility with existing code)
  // --------------------------------------------------------------------------

  /**
   * Helper: List available datasets (server-side registered datasets)
   * 
   * This is separate from tables because datasets are "source data",
   * while tables are "working data" in a session.
   */
  async listDatasets(): Promise<string[]> {
    const res = await fetch(`${this.baseUrl}/tools/datasets`);
    if (!res.ok) throw new Error('Failed to list datasets');
    const data = await res.json();
    return data.datasets || [];
  }

  /**
   * Helper: Get columns for a dataset (before ingesting it)
   * 
   * USE CASE:
   * User wants to filter water_points by 'status' column.
   * We need to show them: "Available columns: id, status, type, geometry"
   */
  async getDatasetColumns(datasetName: string): Promise<string[]> {
    const res = await fetch(
      `${this.baseUrl}/tools/datasets/${encodeURIComponent(datasetName)}/columns`
    );
    if (!res.ok) throw new Error(`Failed to get columns for ${datasetName}`);
    const data = await res.json();
    return data.columns || [];
  }

  /**
   * Helper: Get unique values for a dataset column
   * 
   * USE CASE:
   * User wants to filter by 'status'. We show them a checkbox list:
   * □ active (142 features)
   * □ inactive (58 features)
   * □ maintenance (23 features)
   */
  async getDatasetColumnValues(datasetName: string, column: string): Promise<any[]> {
    const res = await fetch(
      `${this.baseUrl}/tools/datasets/${encodeURIComponent(datasetName)}/columns/${encodeURIComponent(column)}/values`
    );
    if (!res.ok) throw new Error(`Failed to get values for ${datasetName}.${column}`);
    const data = await res.json();
    return data.values || [];
  }
}
